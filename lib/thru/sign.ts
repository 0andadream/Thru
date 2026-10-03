import { sha256, sha512 } from '@noble/hashes/sha2.js';
import * as ed from '@noble/ed25519';

// @noble/ed25519 v3 signs synchronously only after a SHA-512 implementation is attached.
ed.hashes.sha512 = sha512;

const SIGNATURE_SIZE = 64;
const TXN_DST = new TextEncoder().encode('tn_txn_sign_v1__');

/**
 * The current network checks an RFC 8032 signature over `tn_txn_sign_v1__ || SHA-256(body)`.
 * @thru/sdk 0.2.39 still signs with the older domain-block scheme, which the
 * node rejects before execution. Replace the trailing 64-byte signature.
 */
export function resignRawTransaction(raw: Uint8Array, privateKey: Uint8Array): Uint8Array {
  if (raw.length <= SIGNATURE_SIZE) {
    throw new Error('Transaction is too short to sign.');
  }
  if (privateKey.length !== 32) {
    throw new Error('Fee payer private key must contain 32 bytes.');
  }

  const body = raw.subarray(0, raw.length - SIGNATURE_SIZE);
  const digest = sha256(body);
  const message = new Uint8Array(TXN_DST.length + digest.length);
  message.set(TXN_DST, 0);
  message.set(digest, TXN_DST.length);

  const signed = new Uint8Array(raw);
  signed.set(ed.sign(message, privateKey), raw.length - SIGNATURE_SIZE);
  return signed;
}
