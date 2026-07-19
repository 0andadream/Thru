'use client';

import { deriveAddress } from '@thru/sdk';
import { isNameServiceConfigured } from './config';
import {
  deriveDomainAddress,
  deriveRegistrarAddress,
  registerNameOnChain,
} from './nameservice-onchain';
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

/** Preview-mode stand-in address when the name service isn't configured. */
function previewAddress(label: string): string {
  return deriveAddress([new TextEncoder().encode(`thru-name/${label.toLowerCase()}`)]).address;
}

/**
 * Derive the on-chain addresses for a root name and a subdomain. When the name
 * service is configured these are the genuine program-derived registrar/domain
 * addresses; otherwise reproducible preview stand-ins.
 */
export function deriveNameAddresses(root: string, subdomain: string) {
  if (isNameServiceConfigured()) {
    const rootAddress = deriveRegistrarAddress(root);
    return {
      rootAddress,
      subdomainAddress: deriveDomainAddress(rootAddress, subdomain),
    };
  }
  return {
    rootAddress: previewAddress(root),
    subdomainAddress: previewAddress(`${subdomain}.${root}`),
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
    // Real on-chain registration: create the root registrar, then the subdomain.
    const { registrar, domain } = await registerNameOnChain(
      account,
      root,
      subdomain,
      params.onPhase,
    );
    params.onPhase?.('confirmed');
    return {
      root,
      subdomain,
      fullName,
      rootAddress: registrar,
      subdomainAddress: domain,
      records: params.records,
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
