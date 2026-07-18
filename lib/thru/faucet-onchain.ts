'use client';

import { decodeAddress } from '@thru/sdk/helpers';
import { ConsensusStatus } from '@thru/sdk';
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

async function submit(rawTransaction: Uint8Array, onPhase?: (p: TxPhase) => void) {
  const thru = getThru();
  onPhase?.('submitting');
  onPhase?.('confirming');
  for await (const update of thru.transactions.sendAndTrack(rawTransaction, { timeoutMs: 60_000 })) {
    const exec = update.executionResult;
    if (exec && exec.vmError && exec.vmError !== 0) {
      throw new Error(`The network rejected the transaction (vm error ${exec.vmError}).`);
    }
    const done =
      exec ||
      update.consensusStatus === ConsensusStatus.FINALIZED ||
      update.consensusStatus === ConsensusStatus.CLUSTER_EXECUTED;
    if (done) break;
  }
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

  onPhase?.('signing');
  const { rawTransaction } = await thru.transactions.buildAndSign({
    feePayer: { publicKey: publicKeyBytes(account), privateKey: privateKeyBytes(account) },
    program: CREATE_PROGRAM,
    header: {
      fee: 0n,
      nonce: 0n,
      // Account creation is anchored to the slot the CREATING proof was made at.
      startSlot: proof.slot,
      expiryAfter: 100,
      computeUnits: 10_000,
      memoryUnits: 10_000,
      stateUnits: 10_000,
      chainId: thruConfig.chainId,
    },
    feePayerStateProof: proof.proof,
  });
  await submit(rawTransaction, onPhase);
}

/** Submit a faucet withdraw sending `amount` base units to the account itself. */
export async function faucetWithdraw(
  account: ThruAccount,
  amount: bigint,
  onPhase?: (p: TxPhase) => void,
) {
  const thru = getThru();
  const vaultBytes = decodeAddress(FAUCET_VAULT_ADDRESS);
  const selfBytes = publicKeyBytes(account);
  const slot = await currentSlot();

  onPhase?.('signing');
  const { rawTransaction } = await thru.transactions.buildAndSign({
    feePayer: { publicKey: selfBytes, privateKey: privateKeyBytes(account) },
    program: SYSTEM_PROGRAM,
    // Self-recipient: only the vault is an extra account; the recipient is the
    // fee payer (index 0). buildAndSign sorts accounts the same way the CLI does.
    accounts: { readWrite: [vaultBytes] },
    instructionData: async (ctx) => {
      const vaultIndex = ctx.getAccountIndex(vaultBytes);
      const recipientIndex = ctx.getAccountIndex(selfBytes);
      return encodeWithdrawInstruction(vaultIndex, recipientIndex, amount);
    },
    header: {
      fee: 0n,
      nonce: 0n,
      startSlot: slot,
      expiryAfter: 100,
      computeUnits: 300_000,
      memoryUnits: 10_000,
      stateUnits: 10_000,
      chainId: thruConfig.chainId,
    },
  });
  await submit(rawTransaction, onPhase);
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
