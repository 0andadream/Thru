'use client';

import { deriveAddress, deriveProgramAddress } from '@thru/sdk';
import { decodeAddress, encodeAddress } from '@thru/sdk/helpers';
import { getAccountSnapshot } from './account';
import { getThru } from './client';
import { thruConfig } from './config';
import { buildAndSign, currentSlot, ensureAccountExists, submitWithNonce } from './faucet-onchain';
import { publicKeyBytes } from './keys';
import type { ThruAccount, TxPhase } from './types';

export interface RegistrarConfig {
  address: string; nameServiceProgram: string; rootRegistrar: string; treasurer: string;
  tokenMint: string; tokenProgram: string; rootName: string; pricePerYear: bigint;
}

export interface RegistrarQuote {
  config: RegistrarConfig;
  payerTokenAccount: string;
  paymentBalance: bigint;
}

const text = new TextDecoder();
const bytes = new TextEncoder();

export function deriveRegistrarConfigAddress() {
  // The Registrar CLI uses a fixed 32-byte, zero-padded `config` seed.
  const seed = new Uint8Array(32);
  seed.set(bytes.encode('config'));
  return deriveProgramAddress({ programAddress: thruConfig.thruRegistrarProgramAddress, seed }).address;
}

export async function fetchRegistrarConfig(): Promise<RegistrarConfig> {
  const address = deriveRegistrarConfigAddress();
  const account = await getThru().accounts.get(address);
  if (account.meta?.owner?.toThruFmt() !== thruConfig.thruRegistrarProgramAddress) {
    throw new Error('The Alphanet domain registry configuration belongs to an unexpected program.');
  }
  const data = account.data?.data;
  if (!data || data.length < 244) throw new Error('The Alphanet domain registry is not initialized.');
  const at = (offset: number) => encodeAddress(data.slice(offset, offset + 32));
  const rootLength = new DataView(data.buffer, data.byteOffset).getUint32(224, true);
  if (rootLength === 0 || rootLength > 64) throw new Error('The Alphanet domain registry has an invalid root name.');
  return { address, nameServiceProgram: at(0), rootRegistrar: at(32), treasurer: at(64), tokenMint: at(96), tokenProgram: at(128), rootName: text.decode(data.slice(160, 160 + rootLength)), pricePerYear: new DataView(data.buffer, data.byteOffset).getBigUint64(228, true) };
}

async function waitForAccount(address: string, label: string, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if ((await getAccountSnapshot(address)).exists) return;
    await new Promise((resolve) => setTimeout(resolve, 1_500));
  }
  throw new Error(`${label} was created but is not visible on-chain yet. Please try again.`);
}

async function payerFor(account: ThruAccount, config: RegistrarConfig) {
  const { deriveTokenAccountAddress, parseTokenAccountData } = await import('@thru/programs/token');
  const payer = deriveTokenAccountAddress(
    getThru(),
    account.address,
    config.tokenMint,
    config.tokenProgram,
  );
  const snapshot = await getAccountSnapshot(payer.address);
  if (!snapshot.exists) return { payer, balance: 0n };
  const payerAccount = await getThru().accounts.get(payer.address);
  const parsed = parseTokenAccountData(payerAccount);
  if (parsed.mint !== config.tokenMint || parsed.owner !== account.address || parsed.isFrozen) {
    throw new Error('Your registrar payment account is invalid or frozen.');
  }
  return { payer, balance: parsed.amount };
}

export async function getRegistrarQuote(account: ThruAccount): Promise<RegistrarQuote> {
  const config = await fetchRegistrarConfig();
  const { payer, balance } = await payerFor(account, config);
  return { config, payerTokenAccount: payer.address, paymentBalance: balance };
}

function u16(out: Uint8Array, at: number, value: number) { new DataView(out.buffer).setUint16(at, value, true); }
function purchaseData(indices: number[], name: string, years: number, leaseProof: Uint8Array, domainProof: Uint8Array) {
  const nameBytes = bytes.encode(name); const out = new Uint8Array(91 + leaseProof.length + domainProof.length); const dv = new DataView(out.buffer);
  dv.setUint32(0, 1, true); indices.forEach((value, i) => u16(out, 4 + i * 2, value));
  out.set(nameBytes.slice(0, 64), 22); dv.setUint32(86, nameBytes.length, true); out[90] = years;
  out.set(leaseProof, 91); out.set(domainProof, 91 + leaseProof.length); return out;
}

export async function purchaseDomain(account: ThruAccount, name: string, years: number, onPhase?: (p: TxPhase) => void) {
  if (!Number.isInteger(years) || years < 1 || years > 255) throw new Error('Lease length must be between 1 and 255 years.');
  if (!name || bytes.encode(name).length > 64) throw new Error('Domain names must be 1–64 characters.');
  const cfg = await fetchRegistrarConfig(); const thru = getThru();
  const { deriveTokenAccountAddress, createInitializeAccountInstruction } = await import('@thru/programs/token');
  const leaseSeed = deriveAddress([bytes.encode('lease:'), bytes.encode(name)]).bytes;
  const lease = deriveProgramAddress({ programAddress: thruConfig.thruRegistrarProgramAddress, seed: leaseSeed }).address;
  const domainSeed = deriveAddress([decodeAddress(cfg.rootRegistrar), bytes.encode(name)]).bytes;
  const domain = deriveProgramAddress({ programAddress: cfg.nameServiceProgram, seed: domainSeed }).address;
  const payer = deriveTokenAccountAddress(thru, account.address, cfg.tokenMint, cfg.tokenProgram);
  await ensureAccountExists(account, onPhase);
  const header = (nonce: bigint, slot: bigint) => ({ fee: 0n, nonce, startSlot: slot, expiryAfter: 100, computeUnits: 500_000, memoryUnits: 10_000, stateUnits: 10_000, chainId: thruConfig.chainId });
  async function submit(program: string, accounts: { readWrite?: string[]; readOnly?: string[] }, instructionData: Parameters<typeof buildAndSign>[1]['instructionData']) {
    const { nonce } = await getAccountSnapshot(account.address); const slot = await currentSlot();
    await submitWithNonce(nonce, (n) => buildAndSign(account, { program, accounts, instructionData, header: header(n, slot) }), onPhase);
  }
  const payment = await payerFor(account, cfg);
  const required = cfg.pricePerYear * BigInt(years);
  if (payment.balance < required) {
    throw new Error(`This lease costs ${required.toString()} registry payment units for ${years} year${years === 1 ? '' : 's'}, but your payment account has ${payment.balance.toString()}.`);
  }
  if (!(await getAccountSnapshot(payer.address)).exists) {
    const proof = await thru.proofs.generate({ address: payer.address, proofType: 1 } as never);
    await submit(cfg.tokenProgram, { readWrite: [payer.address], readOnly: [cfg.tokenMint] }, createInitializeAccountInstruction({ tokenAccountBytes: payer.bytes, mintAccountBytes: decodeAddress(cfg.tokenMint), ownerAccountBytes: publicKeyBytes(account), seedBytes: new Uint8Array(32), stateProof: proof.proof }));
    await waitForAccount(payer.address, 'Registrar payment account');
  }
  const [leaseProof, domainProof] = await Promise.all([thru.proofs.generate({ address: lease, proofType: 1 } as never), thru.proofs.generate({ address: domain, proofType: 1 } as never)]);
  await submit(thruConfig.thruRegistrarProgramAddress, { readWrite: [cfg.address, lease, domain, cfg.rootRegistrar, cfg.treasurer, payer.address], readOnly: [cfg.nameServiceProgram, cfg.tokenMint, cfg.tokenProgram] }, async (ctx) => purchaseData([cfg.address, lease, domain, cfg.nameServiceProgram, cfg.rootRegistrar, cfg.treasurer, payer.address, cfg.tokenMint, cfg.tokenProgram].map((v) => ctx.getAccountIndex(v)), name, years, leaseProof.proof, domainProof.proof));
  return { cfg, lease, domain, payerTokenAccount: payer.address };
}
