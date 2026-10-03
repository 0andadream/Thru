import assert from 'node:assert/strict';
import test from 'node:test';
import { sha256, sha512 } from '@noble/hashes/sha2.js';
import * as ed from '@noble/ed25519';
import { resignRawTransaction } from './sign';

ed.hashes.sha512 = sha512;

test('signs the transaction body with the current transaction scheme', () => {
  const privateKey = new Uint8Array(32);
  privateKey[0] = 7;
  const body = Uint8Array.from([1, 2, 3, 4, 5]);
  const raw = new Uint8Array(body.length + 64);
  raw.set(body);

  const signed = resignRawTransaction(raw, privateKey);
  const signature = signed.subarray(signed.length - 64);
  const digest = sha256(body);
  const message = new Uint8Array(16 + digest.length);
  message.set(new TextEncoder().encode('tn_txn_sign_v1__'), 0);
  message.set(digest, 16);

  assert.deepEqual(signed.subarray(0, body.length), body);
  assert.equal(ed.verify(signature, message, ed.getPublicKey(privateKey)), true);
  assert.equal(signed.every((byte, index) => byte === raw[index]), false);
});
