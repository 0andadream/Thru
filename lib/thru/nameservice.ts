'use client';

import { getRegistrarQuote, purchaseDomain } from './registrar-onchain';
import type { NameRecord, NameResult, ThruAccount, TxPhase } from './types';

// Registrar domains accept the same friendly labels as the official CLI.
const NAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/;

export function isValidLabel(label: string): boolean {
  return NAME_RE.test(label.toLowerCase());
}

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

/** Load the live registry configuration and the connected wallet's payment balance. */
export { getRegistrarQuote };

/**
 * Purchase a leased second-level domain using Thru's Registrar program.
 * The registrar creates both the lease and the matching Name Service domain.
 */
export async function claimName(
  account: ThruAccount,
  params: { domain: string; records: NameRecord; onPhase?: (p: TxPhase) => void },
): Promise<NameResult> {
  const domain = params.domain.toLowerCase();
  const result = await purchaseDomain(account, domain, 1, params.onPhase);
  params.onPhase?.('confirmed');
  return {
    root: result.cfg.rootName,
    subdomain: domain,
    fullName: `${domain}.${result.cfg.rootName}`,
    rootAddress: result.cfg.rootRegistrar,
    subdomainAddress: result.domain,
    records: params.records,
    onChain: true,
  };
}
