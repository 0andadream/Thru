'use client';

import { AccountView } from '@thru/sdk';
import { getThru } from './client';

export interface AccountSnapshot {
  exists: boolean;
  /** Balance in base units. */
  balance: bigint;
}

/**
 * Read an account's on-chain balance. A brand-new address that has never
 * received funds simply doesn't exist yet on chain — we treat that as a
 * zero balance rather than an error.
 */
export async function getAccountSnapshot(address: string): Promise<AccountSnapshot> {
  const thru = getThru();
  try {
    const account = await thru.accounts.get(address, { view: AccountView.META_ONLY });
    const balance = account.meta?.balance ?? 0n;
    return { exists: true, balance: BigInt(balance) };
  } catch (err) {
    if (isNotFound(err)) {
      return { exists: false, balance: 0n };
    }
    throw err;
  }
}

/** gRPC "not found" is code 5; brand-new accounts return it before funding. */
function isNotFound(err: unknown): boolean {
  const msg = String((err as { message?: string })?.message ?? err ?? '').toLowerCase();
  return (
    msg.includes('not_found') ||
    msg.includes('not found') ||
    msg.includes('code 5') ||
    msg.includes('[not_found]')
  );
}

/**
 * Poll until the account has a positive balance (i.e. the faucet drip landed),
 * or the timeout elapses. Returns the final snapshot either way.
 */
export async function waitForFunds(
  address: string,
  {
    timeoutMs = 60_000,
    intervalMs = 3_000,
    signal,
    onTick,
  }: {
    timeoutMs?: number;
    intervalMs?: number;
    signal?: AbortSignal;
    onTick?: (snapshot: AccountSnapshot) => void;
  } = {},
): Promise<AccountSnapshot> {
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const snap = await getAccountSnapshot(address);
    onTick?.(snap);
    if (snap.balance > 0n) return snap;
    if (Date.now() >= deadline) return snap;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
}

/** Format a base-unit balance for display (assumes 9 decimals like most Thru units). */
export function formatBalance(base: bigint, decimals = 9): string {
  const negative = base < 0n;
  const abs = negative ? -base : base;
  const divisor = 10n ** BigInt(decimals);
  const whole = abs / divisor;
  const frac = abs % divisor;
  const fracStr = frac.toString().padStart(decimals, '0').replace(/0+$/, '');
  const out = fracStr ? `${whole}.${fracStr}` : `${whole}`;
  return negative ? `-${out}` : out;
}
