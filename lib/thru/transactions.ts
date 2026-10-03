'use client';

import { ConsensusStatus, type BuildAndSignTransactionOptions } from '@thru/sdk';
import { encodeSignature } from '@thru/sdk/helpers';
import { getThru } from './client';
import { thruConfig } from './config';
import { privateKeyBytes, publicKeyBytes } from './keys';
import { resignRawTransaction } from './sign';
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
  const privateKey = privateKeyBytes(account);
  const { rawTransaction } = await thru.transactions.buildAndSign({
    feePayer: {
      publicKey: publicKeyBytes(account),
      privateKey,
    },
    program: opts.program,
    accounts: opts.accounts,
    instructionData: opts.instructionData,
    header: {
      chainId: thruConfig.chainId,
      ...opts.header,
    },
  });
  const signedTransaction = resignRawTransaction(rawTransaction, privateKey);

  onPhase?.('submitting');
  const accepted = await thru.transactions.send(signedTransaction);
  onPhase?.('confirming');

  const finalSig = accepted || encodeSignature(signedTransaction.subarray(signedTransaction.length - 64));
  const deadline = Date.now() + (opts.timeoutMs ?? 90_000);
  while (Date.now() < deadline) {
    try {
      const status = await thru.transactions.getStatus(finalSig);
      const exec = status.executionResult;
      if (exec?.vmError) {
        throw new Error(`Transaction reverted [vm ${exec.vmError}]`);
      }
      const done =
        exec ||
        status.statusCode === ConsensusStatus.FINALIZED ||
        status.statusCode === ConsensusStatus.CLUSTER_EXECUTED;
      if (done) {
        onPhase?.('confirmed');
        return { signature: finalSig };
      }
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('Transaction reverted')) throw err;
      const msg = String((err as { message?: string })?.message ?? err).toLowerCase();
      if (!msg.includes('not_found') && !msg.includes('not found')) throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, 2_000));
  }

  throw new Error('Timed out waiting for the transaction to execute.');
}
