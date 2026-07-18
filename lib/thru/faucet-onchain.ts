'use client';

import { decodeAddress } from '@thru/sdk/helpers';
import { ConsensusStatus, type BuildAndSignTransactionOptions } from '@thru/sdk';
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
 * official `thru` CLI and verified to match its output byte-for-byte.
 */
const FAUCET_VAULT_ADDRESS = 'ta-saCJjfH0xDsV2J74AuiWdJTdJ9Kr2REcM_75To19zLf';

// Native "system" program id used by the faucet-withdraw instruction.
const SYSTEM_PROGRAM = new Uint8Array(32);
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

class VmError extends Error {
  constructor(public code: number) {
    super(`The network rejected the transaction (vm error ${code}).`);
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
async function currentSlot(): Promise<bigint> {
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
      throw new VmError(exec.vmError);
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
async function submitWithNonce(
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

async function buildAndSign(
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
        program: SYSTEM_PROGRAM,
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
  await ensureAccountExists(account, onPhase);
  await faucetWithdraw(account, amount, onPhase);
}

export { VmError, VM_FEE_PAYER_DOES_NOT_EXIST };
