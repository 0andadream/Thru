'use client';

import { deriveAddress, deriveProgramAddress } from '@thru/sdk';
import { decodeAddress } from '@thru/sdk/helpers';
import { getThru } from './client';
import { thruConfig } from './config';
import {
  buildAndSign,
  currentSlot,
  ensureAccountExists,
  submitWithNonce,
  VmError,
} from './faucet-onchain';
import { getAccountSnapshot } from './account';
import type { ThruAccount, TxPhase } from './types';

/**
 * Thru name-service registration, reproduced from the official `thru` CLI and
 * verified against its transaction output.
 *
 * Derivation:
 *   registrar(root)        = deriveProgramAddress(NS, root)
 *   domain(parent, name)   = deriveProgramAddress(NS, sha256(parentBytes ‖ name))
 *
 * Instructions (name-service program id, fee 0):
 *   init-root          : u32(0) u16(registrarIdx) u16(0) name[64] u32(len) u32(0) proof[128]
 *   register-subdomain : u32(1) u16(domainIdx) u16(parentIdx) u32(0) name[64] u32(len) u32(0) proof[128]
 * The account-creation state proof (proofType CREATING) is embedded in the
 * instruction itself, not the transaction's proof section.
 */

const CREATING_PROOF_TYPE = 1;
const NAME_FIELD_LEN = 64;
const VM_REVERT = -765;

function nsProgram(): string {
  return thruConfig.nameServiceProgramAddress;
}

export function deriveRegistrarAddress(root: string): string {
  return deriveProgramAddress({ programAddress: nsProgram(), seed: root.toLowerCase() }).address;
}

export function deriveDomainAddress(parentAddress: string, name: string): string {
  const seed = deriveAddress([
    decodeAddress(parentAddress),
    new TextEncoder().encode(name.toLowerCase()),
  ]).bytes;
  return deriveProgramAddress({ programAddress: nsProgram(), seed }).address;
}

function nameField(name: string): Uint8Array {
  const buf = new Uint8Array(NAME_FIELD_LEN);
  buf.set(new TextEncoder().encode(name).slice(0, NAME_FIELD_LEN));
  return buf;
}

function encodeInitRoot(registrarIndex: number, root: string, proof: Uint8Array): Uint8Array {
  const buf = new Uint8Array(80 + proof.length);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, 0, true); // discriminator: init-root
  dv.setUint16(4, registrarIndex, true);
  dv.setUint16(6, 0, true);
  buf.set(nameField(root), 8);
  dv.setUint32(72, root.length, true);
  dv.setUint32(76, 0, true);
  buf.set(proof, 80);
  return buf;
}

function encodeRegisterSubdomain(
  domainIndex: number,
  parentIndex: number,
  name: string,
  proof: Uint8Array,
): Uint8Array {
  const buf = new Uint8Array(84 + proof.length);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, 1, true); // discriminator: register-subdomain
  dv.setUint16(4, domainIndex, true);
  dv.setUint16(6, parentIndex, true);
  dv.setUint32(8, 0, true);
  buf.set(nameField(name), 12);
  dv.setUint32(76, name.length, true);
  dv.setUint32(80, 0, true);
  buf.set(proof, 84);
  return buf;
}

async function creatingProof(address: string): Promise<Uint8Array> {
  const proof = await getThru().proofs.generate({
    address,
    proofType: CREATING_PROOF_TYPE,
  } as never);
  return proof.proof;
}

/** True if the given name-service account already exists on-chain. */
async function exists(address: string): Promise<boolean> {
  return (await getAccountSnapshot(address)).exists;
}

/** Initialize a root registrar (idempotent — skips if it already exists). */
export async function initRoot(account: ThruAccount, root: string, onPhase?: (p: TxPhase) => void) {
  const registrar = deriveRegistrarAddress(root);
  if (await exists(registrar)) return registrar;

  onPhase?.('building');
  const proof = await creatingProof(registrar);
  const registrarBytes = decodeAddress(registrar);
  const { nonce } = await getAccountSnapshot(account.address);
  const slot = await currentSlot();

  try {
    await submitWithNonce(
      nonce,
      (n) =>
        buildAndSign(account, {
          program: nsProgram(),
          accounts: { readWrite: [registrarBytes] },
          instructionData: async (ctx) =>
            encodeInitRoot(ctx.getAccountIndex(registrarBytes), root.toLowerCase(), proof),
          header: {
            fee: 0n,
            nonce: n,
            startSlot: slot,
            expiryAfter: 100,
            computeUnits: 500_000,
            memoryUnits: 10_000,
            stateUnits: 10_000,
            chainId: thruConfig.chainId,
          },
        }),
      onPhase,
    );
  } catch (err) {
    // A revert here usually means the root already exists — tolerate it if so.
    if (err instanceof VmError && err.code === VM_REVERT && (await exists(registrar))) {
      return registrar;
    }
    throw err;
  }
  return registrar;
}

/** Register a subdomain under an existing registrar/parent. */
export async function registerSubdomain(
  account: ThruAccount,
  parentAddress: string,
  name: string,
  onPhase?: (p: TxPhase) => void,
) {
  const domain = deriveDomainAddress(parentAddress, name);
  onPhase?.('building');
  const proof = await creatingProof(domain);
  const domainBytes = decodeAddress(domain);
  const parentBytes = decodeAddress(parentAddress);
  const { nonce } = await getAccountSnapshot(account.address);
  const slot = await currentSlot();

  await submitWithNonce(
    nonce,
    (n) =>
      buildAndSign(account, {
        program: nsProgram(),
        accounts: { readWrite: [domainBytes, parentBytes] },
        instructionData: async (ctx) =>
          encodeRegisterSubdomain(
            ctx.getAccountIndex(domainBytes),
            ctx.getAccountIndex(parentBytes),
            name.toLowerCase(),
            proof,
          ),
        header: {
          fee: 0n,
          nonce: n,
          startSlot: slot,
          expiryAfter: 100,
          computeUnits: 500_000,
          memoryUnits: 10_000,
          stateUnits: 10_000,
          chainId: thruConfig.chainId,
        },
      }),
    onPhase,
  );
  return domain;
}

/** Full flow: ensure the account exists, init the root registrar, register the subdomain. */
export async function registerNameOnChain(
  account: ThruAccount,
  root: string,
  subdomain: string,
  onPhase?: (p: TxPhase) => void,
): Promise<{ registrar: string; domain: string }> {
  await ensureAccountExists(account, onPhase);
  const registrar = await initRoot(account, root, onPhase);
  const domain = await registerSubdomain(account, registrar, subdomain, onPhase);
  return { registrar, domain };
}
