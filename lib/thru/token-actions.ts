'use client';

import { getAccountSnapshot } from './account';
import { getThru } from './client';
import { thruConfig } from './config';
import { buildAndSign, currentSlot, submitWithNonce } from './faucet-onchain';
import { publicKeyBytes } from './keys';
import type { ThruAccount } from './types';

export type TokenAction = 'mint_to' | 'burn' | 'freeze_account' | 'thaw_account' | 'close_account';

/**
 * Run one token-program instruction that does not create an account.
 * Betanet drops the transaction when the header asks for state it does not use.
 */
export async function submitTokenAction(
  account: ThruAccount,
  args: { kind: TokenAction; mint: string; tokenAccount: string; amount?: bigint },
): Promise<void> {
  const { buildTokenInstructionBytes, createMintToInstruction } = await import('@thru/programs/token');
  const { decodeAddress } = await import('@thru/sdk/helpers');
  const mintBytes = decodeAddress(args.mint);
  const tokenBytes = decodeAddress(args.tokenAccount);
  const ownerBytes = publicKeyBytes(account);
  const { nonce } = await getAccountSnapshot(account.address);
  const slot = await currentSlot();

  await submitWithNonce(nonce, (n) =>
    buildAndSign(account, {
      program: thruConfig.tokenProgramAddress,
      accounts: { readWrite: [args.mint, args.tokenAccount] },
      instructionData: async (ctx) => {
        if (args.kind === 'mint_to') {
          return createMintToInstruction({
            mintAccountBytes: mintBytes,
            destinationAccountBytes: tokenBytes,
            authorityAccountBytes: ownerBytes,
            amount: args.amount ?? 0n,
          })(ctx);
        }
        const tokenIndex = ctx.getAccountIndex(tokenBytes);
        const mintIndex = ctx.getAccountIndex(mintBytes);
        const authorityIndex = ctx.getAccountIndex(ownerBytes);
        if (args.kind === 'burn') return buildTokenInstructionBytes('burn', indexedAmount(tokenIndex, mintIndex, authorityIndex, args.amount ?? 0n));
        if (args.kind === 'close_account') {
          return buildTokenInstructionBytes('close_account', indexedAccounts(tokenIndex, authorityIndex, authorityIndex));
        }
        return buildTokenInstructionBytes(args.kind, indexedAccounts(tokenIndex, mintIndex, authorityIndex));
      },
      header: {
        fee: 0n,
        nonce: n,
        startSlot: slot,
        expiryAfter: 100,
        computeUnits: 300_000,
        memoryUnits: 10_000,
        stateUnits: 0,
        chainId: thruConfig.chainId,
      },
    }),
  );
}

function indexedAccounts(first: number, second: number, third: number): Uint8Array {
  const bytes = new Uint8Array(6);
  const view = new DataView(bytes.buffer);
  view.setUint16(0, first, true);
  view.setUint16(2, second, true);
  view.setUint16(4, third, true);
  return bytes;
}

function indexedAmount(token: number, mint: number, authority: number, amount: bigint): Uint8Array {
  const bytes = new Uint8Array(14);
  bytes.set(indexedAccounts(token, mint, authority), 0);
  new DataView(bytes.buffer).setBigUint64(6, amount, true);
  return bytes;
}
