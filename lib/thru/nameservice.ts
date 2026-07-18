'use client';

import { deriveAddress, deriveProgramAddress } from '@thru/sdk';
import { isNameServiceConfigured, thruConfig } from './config';
import { submitTransaction } from './transactions';
import type { NameRecord, NameResult, ThruAccount, TxPhase } from './types';

// 1–32 chars, lowercase alphanumeric + hyphen, no leading/trailing hyphen.
const NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;

export function isValidLabel(label: string): boolean {
  return NAME_RE.test(label.toLowerCase());
}

/** Suggest a few available-looking root names seeded from the address. */
export function suggestRoots(seed: string): string[] {
  const words = ['nova', 'flux', 'orbit', 'pixel', 'delta', 'echo', 'lumen', 'zephyr', 'atlas'];
  const n = parseInt(seed.replace(/[^0-9a-f]/gi, '').slice(-4) || '0', 16);
  const pick = (i: number) => words[(n + i) % words.length];
  return [
    `${pick(0)}${(n % 97).toString().padStart(2, '0')}`,
    `${pick(3)}-${pick(6)}`,
    `${pick(1)}${pick(4)}`,
  ];
}

function nameAddress(label: string, kind: 'root' | 'sub'): string {
  const seedStr = `thru-name/${kind}/${label.toLowerCase()}`;
  // Hash the (possibly long) label into a fixed 32-byte value first so it fits
  // deriveProgramAddress's 32-byte seed limit.
  const hashed = deriveAddress([new TextEncoder().encode(seedStr)]);
  if (isNameServiceConfigured()) {
    // Real program-derived address under the Name Service program.
    return deriveProgramAddress({
      programAddress: thruConfig.nameServiceProgramAddress,
      seed: hashed.bytes,
    }).address;
  }
  // Preview mode: the hashed address is itself a genuine, reproducible address.
  return hashed.address;
}

/**
 * Derive the on-chain addresses for a root name and a subdomain. Uses real
 * address derivation so the addresses are genuine and reproducible.
 */
export function deriveNameAddresses(root: string, subdomain: string) {
  return {
    rootAddress: nameAddress(root, 'root'),
    subdomainAddress: nameAddress(`${subdomain}.${root}`, 'sub'),
  };
}

/**
 * Register a root + subdomain and attach optional records. Submits on-chain
 * when a Name Service program is configured; otherwise returns a clearly
 * labelled preview with genuine derived addresses.
 */
export async function claimName(
  account: ThruAccount,
  params: {
    root: string;
    subdomain: string;
    records: NameRecord;
    onPhase?: (p: TxPhase) => void;
  },
): Promise<NameResult> {
  const root = params.root.toLowerCase();
  const subdomain = params.subdomain.toLowerCase();
  const fullName = `${subdomain}.${root}`;
  const { rootAddress, subdomainAddress } = deriveNameAddresses(root, subdomain);

  if (isNameServiceConfigured()) {
    params.onPhase?.('building');
    // Encode the records as instruction data. The exact wire format is defined
    // by the Name Service program; we pack a compact JSON payload here.
    const payload = new TextEncoder().encode(
      JSON.stringify({ op: 'register', root, subdomain, records: params.records }),
    );
    const { signature } = await submitTransaction(account, {
      program: thruConfig.nameServiceProgramAddress,
      accounts: { readWrite: [rootAddress, subdomainAddress] },
      instructionData: payload,
      onPhase: params.onPhase,
    });
    return {
      root,
      subdomain,
      fullName,
      rootAddress,
      subdomainAddress,
      records: params.records,
      signature,
      onChain: true,
    };
  }

  // Preview mode.
  params.onPhase?.('building');
  await new Promise((r) => setTimeout(r, 700));
  params.onPhase?.('confirmed');
  return {
    root,
    subdomain,
    fullName,
    rootAddress,
    subdomainAddress,
    records: params.records,
    onChain: false,
  };
}
