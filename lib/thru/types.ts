/** Serializable representation of a generated Thru account (wallet). */
export interface ThruAccount {
  /** ta… encoded address (also the public key). */
  address: string;
  /** Hex-encoded 32-byte public key. */
  publicKeyHex: string;
  /** Hex-encoded 32-byte private key. Client-side only — never leaves the device. */
  privateKeyHex: string;
  createdAt: number;
}

/** The JSON keystore file users download to back up their account. */
export interface ThruKeystoreFile {
  format: 'thru-onboard-keystore';
  version: 1;
  network: string;
  address: string;
  publicKey: string;
  privateKey: string;
  createdAt: string;
  warning: string;
}

export interface PasskeyInfo {
  credentialId: string;
  createdAt: number;
}

export type DeployKind = 'token' | 'counter' | 'hello-world';

export interface DeployResult {
  kind: DeployKind;
  label: string;
  /** Primary on-chain address of the deployed artifact (mint / program meta). */
  metaAddress: string;
  /** Secondary address (e.g. buffer / mint-authority token account). */
  bufferAddress?: string;
  /** Transaction signature, when a transaction was actually submitted. */
  signature?: string;
  /** Extra key/value details to surface on the dashboard. */
  details?: Record<string, string>;
  /** True when this was submitted on-chain vs. produced in preview mode. */
  onChain: boolean;
}

export interface NameRecord {
  url?: string;
  twitter?: string;
  linkedPubkey?: string;
}

export interface NameResult {
  root: string;
  subdomain: string;
  fullName: string;
  rootAddress: string;
  subdomainAddress: string;
  records: NameRecord;
  signature?: string;
  onChain: boolean;
}

/** Live status updates surfaced while a transaction is being tracked. */
export type TxPhase =
  | 'idle'
  | 'building'
  | 'signing'
  | 'submitting'
  | 'confirming'
  | 'confirmed'
  | 'error';
