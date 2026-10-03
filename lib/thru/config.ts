/**
 * Central chain configuration. Every network-specific value is read from
 * NEXT_PUBLIC_* environment variables so the same build can target Alphanet,
 * a local devnet, or a future testnet without code changes.
 *
 * Defaults point at Thru Alphanet. See `.env.example` for the full list.
 */

export const thruConfig = {
  rpcUrl: process.env.NEXT_PUBLIC_THRU_RPC_URL ?? 'https://rpc.alphanet.thru.org',
  network: process.env.NEXT_PUBLIC_THRU_NETWORK ?? 'Alphanet',
  explorerUrl: process.env.NEXT_PUBLIC_THRU_EXPLORER_URL ?? 'https://scan.thru.org',
  chainId: Number(process.env.NEXT_PUBLIC_THRU_CHAIN_ID ?? '1'),

  docsUrl: process.env.NEXT_PUBLIC_THRU_DOCS_URL ?? 'https://thru.org/docs/',
  devkitDocsUrl: process.env.NEXT_PUBLIC_THRU_DEVKIT_DOCS_URL ?? 'https://thru.org/docs/',

  // Amount to request per faucet withdraw (base units; CLI caps at 10000/tx).
  faucetAmount: Number(process.env.NEXT_PUBLIC_FAUCET_AMOUNT ?? '10000'),
  faucetAmountLabel: process.env.NEXT_PUBLIC_FAUCET_AMOUNT_LABEL ?? 'test tokens',

  // Community web faucet, offered as a fallback when the in-browser claim
  // keeps failing (e.g. during network instability / an Alphanet reset).
  communityFaucetUrl:
    process.env.NEXT_PUBLIC_COMMUNITY_FAUCET_URL ?? 'https://faucet.thruscan.net',

  // Faucet program and vault from thru-base 0.4.1 (bootstrap_addresses.rs).
  // Both move when Alphanet resets. The vault account has to exist and hold
  // a balance; a withdraw cannot create it.
  faucetProgramAddress:
    process.env.NEXT_PUBLIC_FAUCET_PROGRAM_ADDRESS ??
    'taFCTxR0y2eabGGaEdtTwC9pHz7ZY4CYD7FOiBFUJeAW16',
  faucetVaultAddress:
    process.env.NEXT_PUBLIC_FAUCET_VAULT_ADDRESS ??
    'taTigKYAf5mNxUNUVXeXq1HQodKc07DBzF4Pl7tCi1iXxt',
  // Account creation is a no-op program call plus a CREATING state proof.
  noopProgramAddress:
    process.env.NEXT_PUBLIC_NOOP_PROGRAM_ADDRESS ??
    'taNOOPV4A7S3WTsirr149To2GoGZ9q8zllQaBrbekHfkJT',

  // Well-known native program addresses (from the official `thru` CLI config).
  tokenProgramAddress:
    process.env.NEXT_PUBLIC_TOKEN_PROGRAM_ADDRESS ??
    'taAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKqq',
  nameServiceProgramAddress:
    process.env.NEXT_PUBLIC_NAME_SERVICE_PROGRAM_ADDRESS ??
    'taAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUF',
  thruRegistrarProgramAddress:
    process.env.NEXT_PUBLIC_THRU_REGISTRAR_PROGRAM_ADDRESS ??
    'taAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYG',
} as const;

export function isTokenProgramConfigured(): boolean {
  return thruConfig.tokenProgramAddress.trim().length > 0;
}

export function isNameServiceConfigured(): boolean {
  return thruConfig.nameServiceProgramAddress.trim().length > 0;
}
