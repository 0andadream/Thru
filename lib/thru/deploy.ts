'use client';

import { deriveProgramAddress } from '@thru/sdk';
import { bytesToHex, hexToBytes } from '@/lib/utils';
import { getThru } from './client';
import {
  isTokenProgramConfigured,
  thruConfig,
} from './config';
import { publicKeyBytes } from './keys';
import { submitTransaction } from './transactions';
import type { DeployKind, DeployResult, ThruAccount, TxPhase } from './types';

export interface DeployOption {
  kind: DeployKind;
  label: string;
  tagline: string;
  description: string;
  /** Emoji used as a lightweight, dependency-free icon. */
  glyph: string;
  /** Whether a real on-chain deploy is possible with the current config. */
  onChainAvailable: () => boolean;
  /** For token launches. */
  needsTokenForm?: boolean;
}

export const DEPLOY_OPTIONS: DeployOption[] = [
  {
    kind: 'token',
    label: 'Simple Token',
    tagline: 'Launch your own token',
    glyph: '🪙',
    description:
      'Create a brand-new token mint you control — pick a name, ticker, and decimals. Great first "real" on-chain action.',
    onChainAvailable: isTokenProgramConfigured,
    needsTokenForm: true,
  },
];

export function getDeployOption(kind: DeployKind): DeployOption {
  return DEPLOY_OPTIONS.find((o) => o.kind === kind) ?? DEPLOY_OPTIONS[0];
}

function randomSeedHex(bytes = 16): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return bytesToHex(arr);
}

/**
 * Derive the deterministic mint + token-account preview addresses,
 * using the SDK's real address-derivation primitives. Used for the preview
 * path (when no on-chain program/loader is configured) so users still see and
 * can copy genuine, reproducible addresses.
 */
export function derivePreviewDeployment(
  account: ThruAccount,
  kind: DeployKind,
  seedHex = randomSeedHex(),
): { metaAddress: string; bufferAddress: string; seedHex: string } {
  // deriveProgramAddress caps the seed at 32 bytes, so we pass compact byte
  // seeds. The first byte tags meta (0) vs buffer (1) so the two addresses
  // differ deterministically from the same base seed.
  const base = hexToBytes(seedHex); // 16 bytes
  const metaSeed = new Uint8Array([0, ...base]);
  const bufferSeed = new Uint8Array([1, ...base]);
  const meta = deriveProgramAddress({
    programAddress: account.address,
    seed: metaSeed,
  });
  const buffer = deriveProgramAddress({
    programAddress: account.address,
    seed: bufferSeed,
    ephemeral: true,
  });
  return { metaAddress: meta.address, bufferAddress: buffer.address, seedHex };
}

export interface TokenForm {
  name: string;
  ticker: string;
  decimals: number;
}

/**
 * Deploy the chosen sample. Falls back to a clearly-labelled preview when the
 * required on-chain program isn't configured for this network build.
 */
export async function deploy(
  account: ThruAccount,
  kind: DeployKind,
  opts: { token?: TokenForm; onPhase?: (p: TxPhase) => void } = {},
): Promise<DeployResult> {
  const option = getDeployOption(kind);
  const label = kind === 'token' && opts.token ? opts.token.name : option.label;

  // Real on-chain token mint.
  if (kind === 'token' && isTokenProgramConfigured() && opts.token) {
    return deployTokenOnChain(account, opts.token, opts.onPhase);
  }

  // Fall back to a derived-address preview when the token program is disabled.
  opts.onPhase?.('building');
  const { metaAddress, bufferAddress, seedHex } = derivePreviewDeployment(account, kind);
  // A tiny pause so the UI's progress states read naturally.
  await new Promise((r) => setTimeout(r, 700));
  opts.onPhase?.('confirmed');

  return {
    kind,
    label,
    metaAddress,
    bufferAddress,
    onChain: false,
    details: {
      Seed: seedHex,
      Mode: 'Preview (no on-chain program configured for this network build)',
    },
  };
}

async function deployTokenOnChain(
  account: ThruAccount,
  form: TokenForm,
  onPhase?: (p: TxPhase) => void,
): Promise<DeployResult> {
  const thru = getThru();
  const {
    deriveMintAddress,
    deriveTokenAccountAddress,
    createInitializeMintInstruction,
    createInitializeAccountInstruction,
    createMintToInstruction,
  } = await import('@thru/programs/token');
  const { ensureAccountExists, submitWithNonce, currentSlot, buildAndSign } = await import(
    './faucet-onchain'
  );
  const { getAccountSnapshot } = await import('./account');

  async function waitForAccount(address: string, label: string, timeoutMs = 30_000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if ((await getAccountSnapshot(address)).exists) return;
      await new Promise((resolve) => setTimeout(resolve, 1_500));
    }
    throw new Error(`${label} was submitted but is not visible on-chain yet. Please try again.`);
  }

  const program = thruConfig.tokenProgramAddress;
  const ownerBytes = publicKeyBytes(account);
  const header = (n: bigint, slot: bigint) => ({
    fee: 0n,
    nonce: n,
    startSlot: slot,
    expiryAfter: 100,
    computeUnits: 300_000,
    memoryUnits: 10_000,
    stateUnits: 10_000,
    chainId: thruConfig.chainId,
  });

  // Submit one token instruction, fetching a fresh nonce + slot each time.
  async function step(
    accounts: Parameters<typeof buildAndSign>[1]['accounts'],
    instructionData: Parameters<typeof buildAndSign>[1]['instructionData'],
  ) {
    const { nonce } = await getAccountSnapshot(account.address);
    const slot = await currentSlot();
    await submitWithNonce(
      nonce,
      (n) => buildAndSign(account, { program, accounts, instructionData, header: header(n, slot) }),
      onPhase,
    );
  }

  // The creator/fee-payer account must exist on-chain first (fee 0).
  onPhase?.('building');
  await ensureAccountExists(account, onPhase);

  const ticker = form.ticker.toUpperCase().slice(0, 8);

  // 1) Initialize the mint.
  const seedHex = randomSeedHex(32); // token program requires a 32-byte seed
  const mint = deriveMintAddress(thru, account.address, seedHex, program);
  const mintProof = await thru.proofs.generate({
    address: mint.address,
    proofType: 1 /* CREATING */,
  } as never);
  await step(
    { readWrite: [mint.address] },
    createInitializeMintInstruction({
      mintAccountBytes: mint.bytes,
      decimals: form.decimals,
      mintAuthorityBytes: ownerBytes,
      creatorBytes: ownerBytes,
      ticker,
      seedHex,
      stateProof: mintProof.proof,
    }),
  );
  await waitForAccount(mint.address, 'Token mint');

  // 2) Create the owner's token account, and 3) mint an initial supply into it.
  // If these fail, the mint still exists — surface a partial success.
  let tokenAccountAddress: string | undefined;
  let mintedSupply: bigint | undefined;
  let warning: string | undefined;
  try {
    // The address helper hashes owner + mint + this original seed. The token
    // instruction must receive the original seed, not the derived hash.
    const tokenAccountSeed = new Uint8Array(32);
    const tokenAcc = deriveTokenAccountAddress(
      thru,
      account.address,
      mint.address,
      program,
      tokenAccountSeed,
    );
    const taProof = await thru.proofs.generate({
      address: tokenAcc.address,
      proofType: 1 /* CREATING */,
    } as never);
    await step(
      { readWrite: [tokenAcc.address], readOnly: [mint.address] },
      createInitializeAccountInstruction({
        tokenAccountBytes: tokenAcc.bytes,
        mintAccountBytes: mint.bytes,
        ownerAccountBytes: ownerBytes,
        seedBytes: tokenAccountSeed,
        stateProof: taProof.proof,
      }),
    );
    tokenAccountAddress = tokenAcc.address;
    await waitForAccount(tokenAcc.address, 'Token account');

    const supply = 1_000_000n * 10n ** BigInt(form.decimals);
    await step(
      { readWrite: [mint.address, tokenAcc.address] },
      createMintToInstruction({
        mintAccountBytes: mint.bytes,
        destinationAccountBytes: tokenAcc.bytes,
        authorityAccountBytes: ownerBytes,
        amount: supply,
      }),
    );
    mintedSupply = supply;
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown token-account error';
    warning = `The mint was created, but its token account or initial mint failed: ${message}`;
    // eslint-disable-next-line no-console
    console.warn('Token account / mint-to step failed:', err);
  }

  const details: Record<string, string> = {
    Ticker: ticker,
    Decimals: String(form.decimals),
    'Mint authority': account.address,
  };
  if (tokenAccountAddress) details['Your token account'] = tokenAccountAddress;
  if (mintedSupply) details['Initial supply'] = `1,000,000 ${ticker}`;

  return {
    kind: 'token',
    label: form.name,
    metaAddress: mint.address,
    bufferAddress: tokenAccountAddress,
    onChain: true,
    details,
    warning,
  };
}
