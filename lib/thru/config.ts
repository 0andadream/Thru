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

  // The on-chain faucet vault the withdraw transfers from. This is a deployed
  // address that can change when Alphanet resets — override it here if the
  // in-browser faucet claim reverts while the CLI works.
  faucetVaultAddress:
    process.env.NEXT_PUBLIC_FAUCET_VAULT_ADDRESS ??
    'taxoImN8fTEOxXYnvgC6JZ0lN0n0qvZERwz_vlOjX3MkIn',

  // Well-known native program addresses (from the official `thru` CLI config).
  tokenProgramAddress:
    process.env.NEXT_PUBLIC_TOKEN_PROGRAM_ADDRESS ??
    'taAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAKqq',
  nameServiceProgramAddress:
    process.env.NEXT_PUBLIC_NAME_SERVICE_PROGRAM_ADDRESS ??
    'taAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAUF',
} as const;

export function isTokenProgramConfigured(): boolean {
  return thruConfig.tokenProgramAddress.trim().length > 0;
}

export function isNameServiceConfigured(): boolean {
  return thruConfig.nameServiceProgramAddress.trim().length > 0;
}
