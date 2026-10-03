'use client';

import type { Account } from '@thru/sdk';
import { getAccountSnapshot } from './account';
import { getThru } from './client';
import { thruConfig } from './config';
import { buildAndSign, currentSlot, submitWithNonce } from './faucet-onchain';
import type { ThruAccount } from './types';

const ZERO_SEED = new Uint8Array(32);

export interface SendTokenInput {
  mintAddress: string;
  sourceTokenAccount: string;
  recipient: string;
  amount: bigint;
  onStatus?: (status: 'creating' | 'sending') => void;
}

/**
 * Send tokens to a Thru wallet or an existing token account.
 * A wallet recipient uses the default (zero-seed) token account for this mint.
 * The sender can create that account; the token program does not require the
 * recipient to sign initialization.
 */
export async function sendTokens(account: ThruAccount, input: SendTokenInput): Promise<{ createdAccount: boolean }> {
  if (input.amount <= 0n) throw new Error('Enter an amount greater than zero.');

  const { Pubkey } = await import('@thru/sdk');
  const {
    createInitializeAccountInstruction,
    createTransferInstruction,
    deriveTokenAccountAddress,
    parseMintAccountData,
    parseTokenAccountData,
  } = await import('@thru/programs/token');
  const { decodeAddress } = await import('@thru/sdk/helpers');

  let recipient: string;
  try {
    recipient = Pubkey.from(input.recipient.trim()).toThruFmt();
  } catch {
    throw new Error('Enter a Thru address (ta…) or a token-account address.');
  }

  const sourceAccount = await readAccount(input.sourceTokenAccount);
  if (!sourceAccount) throw new Error('Your token account is not on-chain yet.');
  const source = parseTokenAccountData(sourceAccount);
  if (source.mint !== input.mintAddress) throw new Error('The selected token does not match this token account.');
  if (source.isFrozen) throw new Error('Your token account is frozen.');
  if (source.amount < input.amount) throw new Error('Your token balance is lower than the amount you entered.');

  const destination = await resolveDestination({
    recipient,
    mintAddress: input.mintAddress,
    parseMintAccountData,
    parseTokenAccountData,
  });

  let createdAccount = false;
  let destinationAddress = destination.address;
  if (!destination.info) {
    if (!destination.ownerExists) {
      throw new Error('No account exists at that address. Paste an on-chain Thru wallet, or an existing token account for this mint.');
    }
    input.onStatus?.('creating');
    destinationAddress = await createDefaultTokenAccount(account, recipient, input.mintAddress, {
      deriveTokenAccountAddress,
      createInitializeAccountInstruction,
      decodeAddress,
    });
    createdAccount = true;
  } else if (destination.info.isFrozen) {
    throw new Error('The recipient token account is frozen.');
  }

  if (destinationAddress === input.sourceTokenAccount) {
    throw new Error('That address is the token account you are sending from.');
  }

  input.onStatus?.('sending');
  const { nonce } = await getAccountSnapshot(account.address);
  const slot = await currentSlot();
  await submitWithNonce(nonce, (nonceValue) =>
    buildAndSign(account, {
      program: thruConfig.tokenProgramAddress,
      accounts: { readWrite: [input.sourceTokenAccount, destinationAddress] },
      instructionData: createTransferInstruction({
        sourceAccountBytes: decodeAddress(input.sourceTokenAccount),
        destinationAccountBytes: decodeAddress(destinationAddress),
        amount: input.amount,
      }),
      header: txHeader(nonceValue, slot),
    }),
  );

  return { createdAccount };
}

async function resolveDestination({
  recipient,
  mintAddress,
  parseMintAccountData,
  parseTokenAccountData,
}: {
  recipient: string;
  mintAddress: string;
  parseMintAccountData: (account: Account) => unknown;
  parseTokenAccountData: (account: Account) => { mint: string; isFrozen: boolean };
}): Promise<{ address: string; info: { mint: string; isFrozen: boolean } | null; ownerExists: boolean }> {
  const existing = await readAccount(recipient);
  if (!existing) return { address: recipient, info: null, ownerExists: false };

  const tokenInfo = tryParse(existing, parseTokenAccountData);
  if (tokenInfo) {
    if (tokenInfo.mint !== mintAddress) {
      throw new Error('That token account belongs to a different token.');
    }
    return { address: recipient, info: tokenInfo, ownerExists: true };
  }

  if (tryParse(existing, parseMintAccountData)) {
    throw new Error('That address is a token mint. Paste the recipient wallet or their token account.');
  }

  const owner = existing.meta?.owner?.toThruFmt();
  if (owner === thruConfig.tokenProgramAddress) {
    throw new Error('That token account could not be read.');
  }

  const { deriveTokenAccountAddress } = await import('@thru/programs/token');
  const derived = deriveTokenAccountAddress(
    getThru(),
    recipient,
    mintAddress,
    thruConfig.tokenProgramAddress,
    ZERO_SEED,
  );
  const derivedAccount = await readAccount(derived.address);
  if (!derivedAccount) return { address: derived.address, info: null, ownerExists: true };

  const derivedInfo = parseTokenAccountData(derivedAccount);
  if (derivedInfo.mint !== mintAddress) {
    throw new Error('The recipient token account belongs to a different token mint.');
  }
  return { address: derived.address, info: derivedInfo, ownerExists: true };
}

async function createDefaultTokenAccount(
  payer: ThruAccount,
  ownerAddress: string,
  mintAddress: string,
  sdk: {
    deriveTokenAccountAddress: (
      thru: ReturnType<typeof getThru>,
      owner: string,
      mint: string,
      program: string,
      seed: Uint8Array,
    ) => { address: string; bytes: Uint8Array };
    createInitializeAccountInstruction: (args: {
      tokenAccountBytes: Uint8Array;
      mintAccountBytes: Uint8Array;
      ownerAccountBytes: Uint8Array;
      seedBytes: Uint8Array;
      stateProof: Uint8Array;
    }) => (ctx: { getAccountIndex: (pubkey: Uint8Array) => number }) => Promise<Uint8Array>;
    decodeAddress: (address: string) => Uint8Array;
  },
): Promise<string> {
  const thru = getThru();
  const derived = sdk.deriveTokenAccountAddress(
    thru,
    ownerAddress,
    mintAddress,
    thruConfig.tokenProgramAddress,
    ZERO_SEED,
  );
  const proof = await thru.proofs.generate({ address: derived.address, proofType: 1 } as never);
  const readOnly = [mintAddress];
  if (ownerAddress !== payer.address) readOnly.push(ownerAddress);

  try {
    const { nonce } = await getAccountSnapshot(payer.address);
    const slot = await currentSlot();
    await submitWithNonce(nonce, (nonceValue) =>
      buildAndSign(payer, {
        program: thruConfig.tokenProgramAddress,
        accounts: { readWrite: [derived.address], readOnly },
        instructionData: sdk.createInitializeAccountInstruction({
          tokenAccountBytes: derived.bytes,
          mintAccountBytes: sdk.decodeAddress(mintAddress),
          ownerAccountBytes: sdk.decodeAddress(ownerAddress),
          seedBytes: ZERO_SEED,
          stateProof: proof.proof,
        }),
        header: txHeader(nonceValue, slot),
      }),
    );
  } catch (error) {
    if (!(await getAccountSnapshot(derived.address)).exists) throw error;
  }

  const deadline = Date.now() + 30_000;
  while (!(await getAccountSnapshot(derived.address)).exists) {
    if (Date.now() > deadline) {
      throw new Error('The recipient token account was submitted but is not visible yet. Try the send again shortly.');
    }
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  return derived.address;
}

function txHeader(nonce: bigint, slot: bigint) {
  return {
    fee: 0n,
    nonce,
    startSlot: slot,
    expiryAfter: 100,
    computeUnits: 300_000,
    memoryUnits: 10_000,
    stateUnits: 10_000,
    chainId: thruConfig.chainId,
  };
}

function tryParse<T>(account: Account, parse: (account: Account) => T): T | null {
  try {
    return parse(account);
  } catch {
    return null;
  }
}

async function readAccount(address: string): Promise<Account | null> {
  try {
    return await getThru().accounts.get(address);
  } catch (error) {
    const message = String((error as { message?: string })?.message ?? error ?? '').toLowerCase();
    if (message.includes('not_found') || message.includes('not found') || message.includes('code 5') || message.includes('[not_found]')) {
      return null;
    }
    throw error;
  }
}
