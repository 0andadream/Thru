'use client';

import { keys } from '@thru/sdk';
import { encodeAddress } from '@thru/sdk/helpers';
import { bytesToHex, hexToBytes } from '@/lib/utils';
import { thruConfig } from './config';
import type { ThruAccount, ThruKeystoreFile } from './types';

/**
 * Generate a brand-new Thru account entirely in the browser using the SDK's
 * Ed25519 keypair generator (the same HD-wallet pipeline the Thru wallet uses).
 * The private key never leaves this device.
 */
export async function generateAccount(): Promise<ThruAccount> {
  const kp = await keys.generateKeyPair();
  return {
    address: kp.address,
    publicKeyHex: bytesToHex(kp.publicKey),
    privateKeyHex: bytesToHex(kp.privateKey),
    createdAt: Date.now(),
  };
}

/** Restore an account from a 32-byte Ed25519 private key. */
export async function importAccountFromPrivateKey(value: string): Promise<ThruAccount> {
  const privateKeyHex = value.trim().replace(/^0x/i, '').replace(/\s+/g, '').toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(privateKeyHex)) {
    throw new Error('Enter a valid 64-character hexadecimal private key.');
  }

  const privateKey = hexToBytes(privateKeyHex);
  const publicKey = await keys.fromPrivateKey(privateKey);
  return {
    address: encodeAddress(publicKey),
    publicKeyHex: bytesToHex(publicKey),
    privateKeyHex,
    createdAt: Date.now(),
  };
}

/** Recover the raw private key bytes for signing. */
export function privateKeyBytes(account: ThruAccount): Uint8Array {
  return hexToBytes(account.privateKeyHex);
}

/** Recover the raw public key bytes. */
export function publicKeyBytes(account: ThruAccount): Uint8Array {
  return hexToBytes(account.publicKeyHex);
}

/** Build the downloadable JSON keystore payload. */
export function toKeystoreFile(account: ThruAccount): ThruKeystoreFile {
  return {
    format: 'thru-onboard-keystore',
    version: 1,
    network: thruConfig.network,
    address: account.address,
    publicKey: account.publicKeyHex,
    privateKey: account.privateKeyHex,
    createdAt: new Date(account.createdAt).toISOString(),
    warning:
      'KEEP THIS FILE SECRET. Anyone with this private key controls this account. ' +
      'Thru Onboard never stores or transmits your private key. Testnet account.',
  };
}

/** Trigger a browser download of the keystore JSON file. */
export function downloadKeystore(account: ThruAccount) {
  const data = toKeystoreFile(account);
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `thru-keystore-${account.address.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** The plain-text private key export (for the "copy" flow). */
export function privateKeyText(account: ThruAccount): string {
  return account.privateKeyHex;
}
