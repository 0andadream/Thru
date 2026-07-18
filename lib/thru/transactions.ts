'use client';

import { ConsensusStatus, type BuildAndSignTransactionOptions } from '@thru/sdk';
import { getThru } from './client';
import { thruConfig } from './config';
import { privateKeyBytes, publicKeyBytes } from './keys';
import type { ThruAccount, TxPhase } from './types';

export interface SubmitResult {
  signature: string;
}

export interface SubmitOptions {
  program: BuildAndSignTransactionOptions['program'];
  accounts?: BuildAndSignTransactionOptions['accounts'];
  instructionData?: BuildAndSignTransactionOptions['instructionData'];
  header?: BuildAndSignTransactionOptions['header'];
  timeoutMs?: number;
  onPhase?: (phase: TxPhase) => void;
}

/**
 * Build, sign (locally), submit, and track a transaction to finality. Signing
 * uses the account's private key bytes in-memory only; they never leave the
 * browser. Returns the transaction signature once accepted/executed.
 */
export async function submitTransaction(
  account: ThruAccount,
  opts: SubmitOptions,
): Promise<SubmitResult> {
  const thru = getThru();
  const { onPhase } = opts;

  onPhase?.('building');
  onPhase?.('signing');
  const { rawTransaction, signature } = await thru.transactions.buildAndSign({
    feePayer: {
      publicKey: publicKeyBytes(account),
      privateKey: privateKeyBytes(account),
    },
    program: opts.program,
    accounts: opts.accounts,
    instructionData: opts.instructionData,
    header: {
      chainId: thruConfig.chainId,
      ...opts.header,
    },
  });

  onPhase?.('submitting');
  onPhase?.('confirming');

  let finalSig = signatureToString(signature);
  for await (const update of thru.transactions.sendAndTrack(rawTransaction, {
    timeoutMs: opts.timeoutMs ?? 60_000,
  })) {
    if (update.signature?.value) {
      finalSig = bytesToHexLike(update.signature.value) || finalSig;
    }
    const done =
      update.executionResult ||
      update.consensusStatus === ConsensusStatus.FINALIZED ||
      update.consensusStatus === ConsensusStatus.CLUSTER_EXECUTED;
    if (done) break;
  }

  onPhase?.('confirmed');
  return { signature: finalSig };
}

function signatureToString(sig: unknown): string {
  if (!sig) return '';
  if (typeof sig === 'string') return sig;
  // SignedTransactionResult.signature is a domain Signature with toThruFmt().
  const anySig = sig as { toThruFmt?: () => string; value?: Uint8Array };
  if (typeof anySig.toThruFmt === 'function') return anySig.toThruFmt();
  if (anySig.value) return bytesToHexLike(anySig.value);
  return String(sig);
}

function bytesToHexLike(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
