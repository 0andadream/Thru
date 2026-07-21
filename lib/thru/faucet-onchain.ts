'use client';

import { decodeAddress } from '@thru/sdk/helpers';
import { ConsensusStatus, type BuildAndSignTransactionOptions } from '@thru/sdk';
import { sleep } from '@/lib/utils';
import { getThru } from './client';
import { thruConfig } from './config';
import { getAccountSnapshot } from './account';
import { privateKeyBytes, publicKeyBytes } from './keys';
import type { ThruAccount, TxPhase } from './types';

/**
 * Thru's faucet is an on-chain program. A claim is just a transaction with a
 * zero (native) program id and a 16-byte instruction:
 *   u32(1) discriminator | u16(vaultIndex) | u16(recipientIndex) | u64(amount)
 * where the indices are positions in the transaction's (sorted) account list.
 * Fees are 0 on the network, so a freshly-created account can claim for itself
 * with no operator, no server, and no CLI.
 *
 * The faucet vault address and this instruction layout were reproduced from the
 * official `thru` CLI and verified to match its output byte-for-byte. The vault
 * is a deployed address (configurable, since it can change on network resets).
 */
const FAUCET_VAULT_ADDRESS = thruConfig.faucetVaultAddress;

// Official faucet program id (FAUCET_PROGRAM in Thru's txn_tools.rs):
// 31 zero bytes followed by 0xFA.
const FAUCET_PROGRAM = (() => {
  const p = new Uint8Array(32);
  p[31] = 0xfa;
  return p;
})();
// Native account-creation program id (all zero except the last byte).
const CREATE_PROGRAM = (() => {
  const p = new Uint8Array(32);
  p[31] = 3;
  return p;
})();

const WITHDRAW_DISCRIMINATOR = 1;
const CREATING_PROOF_TYPE = 1;

// VM error codes (from the SDK's TransactionVmError enum).
const VM_NONCE_TOO_LOW = -511;
const VM_NONCE_TOO_HIGH = -510;
const VM_FEE_PAYER_DOES_NOT_EXIST = -508;
const VM_REVERT = -765;

const VM_MESSAGES: Record<number, string> = {
  [-511]: 'nonce too low',
  [-510]: 'nonce too high',
  [-509]: 'insufficient fee-payer balance',
  [-508]: 'fee-payer account does not exist',
  [-507]: 'account not live yet',
  [-506]: 'transaction expired',
  [-765]: 'the on-chain program rejected the transaction',
  [-766]: 'invalid program account',
  [-767]: 'program execution failed',
  [-764]: 'compute units exhausted',
};

class VmError extends Error {
  constructor(
    public code: number,
    public userErrorCode?: bigint,
  ) {
    const label = VM_MESSAGES[code] ?? `vm error ${code}`;
    const signedUserError =
      userErrorCode != null ? BigInt.asIntN(64, BigInt(userErrorCode)) : undefined;
    const extra =
      signedUserError != null && signedUserError !== 0n
        ? ` (program code ${signedUserError})`
        : '';
    super(`${label}${extra} [vm ${code}]`);
    this.name = 'VmError';
  }
}

function encodeWithdrawInstruction(
  vaultIndex: number,
  recipientIndex: number,
  amount: bigint,
): Uint8Array {
  const buf = new Uint8Array(16);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, WITHDRAW_DISCRIMINATOR, true);
  dv.setUint16(4, vaultIndex, true);
  dv.setUint16(6, recipientIndex, true);
  dv.setBigUint64(8, amount, true);
  return buf;
}

/** Most-recent usable slot for a transaction's startSlot (avoids expiry). */
export async function currentSlot(): Promise<bigint> {
  const h = await getThru().blocks.getBlockHeight();
  const candidates = [h.clusterExecuted, h.locallyExecuted, h.finalized]
    .filter((v) => v != null)
    .map((v) => BigInt(v));
  return candidates.length ? candidates.reduce((a, b) => (a > b ? a : b)) : 0n;
}

/** Submit a signed transaction and wait for execution; throw VmError on failure. */
async function submit(rawTransaction: Uint8Array, onPhase?: (p: TxPhase) => void) {
  const thru = getThru();
  onPhase?.('submitting');
  onPhase?.('confirming');
  for await (const update of thru.transactions.sendAndTrack(rawTransaction, { timeoutMs: 60_000 })) {
    const exec = update.executionResult;
    if (exec && exec.vmError && exec.vmError !== 0) {
      throw new VmError(exec.vmError, exec.userErrorCode);
    }
    const done =
      exec ||
      update.consensusStatus === ConsensusStatus.FINALIZED ||
      update.consensusStatus === ConsensusStatus.CLUSTER_EXECUTED;
    if (done) break;
  }
}

/**
 * Build + submit a transaction, adjusting the nonce if the node reports it as
 * too low/high. The on-chain nonce read can lag behind the executing state, so
 * we converge to the accepted value instead of guessing.
 */
export async function submitWithNonce(
  startNonce: bigint,
  buildRaw: (nonce: bigint) => Promise<Uint8Array>,
  onPhase?: (p: TxPhase) => void,
): Promise<void> {
  let nonce = startNonce < 0n ? 0n : startNonce;
  let lastError: unknown;
  for (let attempt = 0; attempt < 15; attempt++) {
    onPhase?.('signing');
    const raw = await buildRaw(nonce);
    try {
      await submit(raw, onPhase);
      return;
    } catch (err) {
      lastError = err;
      if (err instanceof VmError && err.code === VM_NONCE_TOO_LOW) {
        nonce += 1n;
        continue;
      }
      if (err instanceof VmError && err.code === VM_NONCE_TOO_HIGH) {
        nonce = nonce > 0n ? nonce - 1n : 0n;
        continue;
      }
      throw err;
    }
  }
  throw lastError ?? new Error('Could not find a valid nonce for the transaction.');
}

export async function buildAndSign(
  account: ThruAccount,
  opts: Omit<BuildAndSignTransactionOptions, 'feePayer'>,
): Promise<Uint8Array> {
  const { rawTransaction } = await getThru().transactions.buildAndSign({
    feePayer: { publicKey: publicKeyBytes(account), privateKey: privateKeyBytes(account) },
    ...opts,
  });
  return rawTransaction;
}

/** Create the account on-chain if it doesn't exist yet (fee 0, self-signed). */
export async function ensureAccountExists(account: ThruAccount, onPhase?: (p: TxPhase) => void) {
  const snap = await getAccountSnapshot(account.address);
  if (snap.exists) return;

  onPhase?.('building');
  const thru = getThru();
  const proof = await thru.proofs.generate({
    address: account.address,
    proofType: CREATING_PROOF_TYPE,
  } as never);

  try {
    await submitWithNonce(
      0n,
      (nonce) =>
        buildAndSign(account, {
          program: CREATE_PROGRAM,
          header: {
            fee: 0n,
            nonce,
            // Anchored to the slot the CREATING proof was made at.
            startSlot: proof.slot,
            expiryAfter: 100,
            computeUnits: 10_000,
            memoryUnits: 10_000,
            stateUnits: 10_000,
            chainId: thruConfig.chainId,
          },
          feePayerStateProof: proof.proof,
        }),
      onPhase,
    );
  } catch (err) {
    // If the account exists now (e.g. a concurrent/previous create landed),
    // that's success as far as we're concerned.
    const after = await getAccountSnapshot(account.address);
    if (!after.exists) throw err;
  }

  // Wait until the freshly-created account is actually queryable before we try
  // to spend from it — a brand-new account can take a few seconds to become
  // visible, which otherwise shows up as a faucet revert.
  await waitUntilVisible(account.address);
}

/** Poll until the account is visible on-chain (or timeout). */
async function waitUntilVisible(address: string, timeoutMs = 20_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await getAccountSnapshot(address)).exists) return;
    await sleep(2000);
  }
}

/** Submit a faucet withdraw sending `amount` base units to the account itself. */
export async function faucetWithdraw(
  account: ThruAccount,
  amount: bigint,
  onPhase?: (p: TxPhase) => void,
) {
  const vaultBytes = decodeAddress(FAUCET_VAULT_ADDRESS);
  const selfBytes = publicKeyBytes(account);
  const { nonce } = await getAccountSnapshot(account.address);
  const slot = await currentSlot();

  await submitWithNonce(
    nonce,
    (n) =>
      buildAndSign(account, {
        program: FAUCET_PROGRAM,
        // Self-recipient: only the vault is an extra account; the recipient is
        // the fee payer (index 0). buildAndSign sorts accounts like the CLI.
        accounts: { readWrite: [vaultBytes] },
        instructionData: async (ctx) => {
          const vaultIndex = ctx.getAccountIndex(vaultBytes);
          const recipientIndex = ctx.getAccountIndex(selfBytes);
          return encodeWithdrawInstruction(vaultIndex, recipientIndex, amount);
        },
        header: {
          fee: 0n,
          nonce: n,
          startSlot: slot,
          expiryAfter: 100,
          computeUnits: 300_000,
          memoryUnits: 10_000,
          stateUnits: 10_000,
          chainId: thruConfig.chainId,
        },
      }),
    onPhase,
  );
}

/**
 * Full one-click claim, entirely client-side: make sure the account exists,
 * then claim tokens from the faucet to it. No server, operator, or CLI needed.
 */
export async function claimFaucetInBrowser(
  account: ThruAccount,
  amount: bigint = BigInt(thruConfig.faucetAmount),
  onPhase?: (p: TxPhase) => void,
) {
  // Step 1: make sure the account exists + is visible on-chain. Don't hard-fail
  // here — the withdraw below is authoritative (it reports -508 if the account
  // really isn't there), which lets us attribute the error to the right step.
  let createError: unknown;
  try {
    await ensureAccountExists(account, onPhase);
  } catch (err) {
    createError = err;
  }

  // Step 2: claim from the faucet. A revert (-765) is usually the faucet being
  // low/rate-limited or the amount exceeding what it can currently dispense, so
  // ladder the amount down and take whatever the faucet will actually give.
  const ladder = amountLadder(amount);
  let lastError: unknown;
  for (let i = 0; i < ladder.length; i++) {
    try {
      await faucetWithdraw(account, ladder[i], onPhase);
      return;
    } catch (err) {
      lastError = err;
      if (
        err instanceof VmError &&
        err.code === VM_FEE_PAYER_DOES_NOT_EXIST &&
        createError instanceof Error
      ) {
        throw new Error(`Account activation failed — ${createError.message}`);
      }
      // On a program revert, try a smaller amount; otherwise stop.
      if (err instanceof VmError && err.code === VM_REVERT && i < ladder.length - 1) {
        onPhase?.('confirming');
        await sleep(1500);
        continue;
      }
      break;
    }
  }

  if (lastError instanceof Error) {
    throw new Error(`Faucet claim failed — ${lastError.message}`);
  }
  throw lastError ?? new Error('Faucet claim failed.');
}

/** Descending amounts to try, so we take whatever a low faucet can dispense. */
function amountLadder(requested: bigint): bigint[] {
  const steps = [requested, 1000n, 100n, 25n, 10n, 1n];
  const seen = new Set<string>();
  return steps
    .filter((a) => a > 0n && a <= requested)
    .filter((a) => (seen.has(a.toString()) ? false : (seen.add(a.toString()), true)));
}

export { VmError, VM_FEE_PAYER_DOES_NOT_EXIST };
