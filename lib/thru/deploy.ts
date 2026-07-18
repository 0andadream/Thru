'use client';

import { deriveProgramAddress } from '@thru/sdk';
import { bytesToHex, hexToBytes } from '@/lib/utils';
import { getThru } from './client';
import {
  isProgramLoaderConfigured,
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
  {
    kind: 'counter',
    label: 'Counter',
    tagline: 'A classic counter program',
    glyph: '🔢',
    description:
      'The blockchain "hello world" — a program that stores a number you can increment. Perfect for learning how programs deploy.',
    onChainAvailable: isProgramLoaderConfigured,
  },
  {
    kind: 'hello-world',
    label: 'Hello World',
    tagline: 'Minimal on-chain program',
    glyph: '👋',
    description:
      'The smallest possible program: it logs a greeting when invoked. See how a program gets a Meta and Buffer address on Thru.',
    onChainAvailable: isProgramLoaderConfigured,
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
 * Derive the deterministic Meta + Buffer addresses a deployment WOULD occupy,
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

  // Real on-chain program deploy would go here once a loader + binary exist.
  // Until then, every path resolves to a genuine derived-address preview.
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
  const { deriveMintAddress, createInitializeMintInstruction } = await import(
    '@thru/programs/token'
  );
  const { ensureAccountExists, submitWithNonce, currentSlot, buildAndSign } = await import(
    './faucet-onchain'
  );
  const { getAccountSnapshot } = await import('./account');

  // The creator/fee-payer account must exist on-chain first (fee 0).
  onPhase?.('building');
  await ensureAccountExists(account, onPhase);

  const ticker = form.ticker.toUpperCase().slice(0, 8);
  // The token program requires a 32-byte (64 hex char) mint-derivation seed.
  const seedHex = randomSeedHex(32);
  const mint = deriveMintAddress(thru, account.address, seedHex, thruConfig.tokenProgramAddress);

  // Prove the (empty) mint account slot so the program can initialize it.
  const stateProof = await thru.proofs.generate({
    address: mint.address,
    proofType: 1 /* CREATING */,
  } as never);

  const instruction = createInitializeMintInstruction({
    mintAccountBytes: mint.bytes,
    decimals: form.decimals,
    mintAuthorityBytes: publicKeyBytes(account),
    creatorBytes: publicKeyBytes(account),
    ticker,
    seedHex,
    stateProof: stateProof.proof,
  });

  const { nonce } = await getAccountSnapshot(account.address);
  const slot = await currentSlot();

  await submitWithNonce(
    nonce,
    (n) =>
      buildAndSign(account, {
        program: thruConfig.tokenProgramAddress,
        accounts: { readWrite: [mint.address] },
        instructionData: instruction,
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

  return {
    kind: 'token',
    label: form.name,
    metaAddress: mint.address,
    bufferAddress: undefined,
    onChain: true,
    details: {
      Ticker: ticker,
      Decimals: String(form.decimals),
      'Mint authority': account.address,
    },
  };
}
