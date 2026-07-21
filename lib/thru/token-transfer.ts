'use client';

import { Pubkey } from '@thru/sdk';
import { getAccountSnapshot } from './account';
import { thruConfig } from './config';
import { getThru } from './client';
import { buildAndSign, currentSlot, ensureAccountExists, submitWithNonce } from './faucet-onchain';
import type { ThruAccount, TxPhase } from './types';

export interface TokenTransferInput {
  mintAddress: string;
  sourceTokenAccount: string;
  recipientAddress: string;
  amount: bigint;
}

export interface TokenTransferResult {
  recipientTokenAccount: string;
}

/**
 * Transfer a token created by this app. The recipient only needs their Thru
 * address: when their deterministic token account is absent, the sender funds
 * its zero-fee initialization before submitting the transfer.
 */
export async function transferToken(
  account: ThruAccount,
  input: TokenTransferInput,
  onPhase?: (phase: TxPhase) => void,
): Promise<TokenTransferResult> {
  if (input.amount <= 0n) throw new Error('Enter an amount greater than zero.');

  const thru = getThru();
  const { deriveTokenAccountAddress, createInitializeAccountInstruction, createTransferInstruction } =
    await import('@thru/programs/token');
  const { mintAddress, sourceTokenAccount, recipientAddress, amount } = input;

  let recipientBytes: Uint8Array;
  try {
    recipientBytes = Pubkey.from(recipientAddress.trim()).toBytes();
  } catch {
    throw new Error('Enter a valid Thru recipient address.');
  }
  if (recipientAddress.trim() === account.address) {
    throw new Error('Choose another recipient address.');
  }

  await ensureAccountExists(account, onPhase);
  const tokenProgram = thruConfig.tokenProgramAddress;
  const recipientToken = deriveTokenAccountAddress(
    thru,
    recipientAddress.trim(),
    mintAddress,
    tokenProgram,
  );
  const sourceBytes = Pubkey.from(sourceTokenAccount).toBytes();
  const mintBytes = Pubkey.from(mintAddress).toBytes();

  const header = (nonce: bigint, slot: bigint) => ({
    fee: 0n,
    nonce,
    startSlot: slot,
    expiryAfter: 100,
    computeUnits: 300_000,
    memoryUnits: 10_000,
    stateUnits: 10_000,
    chainId: thruConfig.chainId,
  });
  async function submit(
    accounts: Parameters<typeof buildAndSign>[1]['accounts'],
    instructionData: Parameters<typeof buildAndSign>[1]['instructionData'],
  ) {
    const { nonce } = await getAccountSnapshot(account.address);
    const slot = await currentSlot();
    await submitWithNonce(
      nonce,
      (n) => buildAndSign(account, { program: tokenProgram, accounts, instructionData, header: header(n, slot) }),
      onPhase,
    );
  }

  // The default token-account seed is deterministic. It lets a sender prepare
  // a recipient's account without ever needing that recipient's private key.
  if (!(await getAccountSnapshot(recipientToken.address)).exists) {
    onPhase?.('building');
    const proof = await thru.proofs.generate({ address: recipientToken.address, proofType: 1 } as never);
    await submit(
      { readWrite: [recipientToken.address], readOnly: [mintAddress] },
      createInitializeAccountInstruction({
        tokenAccountBytes: recipientToken.bytes,
        mintAccountBytes: mintBytes,
        ownerAccountBytes: recipientBytes,
        seedBytes: new Uint8Array(32),
        stateProof: proof.proof,
      }),
    );
  }

  await submit(
    { readWrite: [sourceTokenAccount, recipientToken.address] },
    createTransferInstruction({
      sourceAccountBytes: sourceBytes,
      destinationAccountBytes: recipientToken.bytes,
      amount,
    }),
  );
  return { recipientTokenAccount: recipientToken.address };
}
