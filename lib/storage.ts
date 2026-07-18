'use client';

/**
 * Minimal, safe localStorage wrapper. Used to persist wizard progress so a
 * refresh doesn't lose the freshly-created account. NOTE: the private key is
 * stored locally only because this is a testnet onboarding tool and users are
 * strongly prompted to download a backup. It never leaves the browser.
 */

const PREFIX = 'thru-onboard:';

export function readJSON<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export function writeJSON<T>(key: string, value: T): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function remove(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}
