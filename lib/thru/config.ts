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
  explorerUrl:
    process.env.NEXT_PUBLIC_THRU_EXPLORER_URL ?? 'https://explorer.alphanet.thru.org',
  chainId: Number(process.env.NEXT_PUBLIC_THRU_CHAIN_ID ?? '1'),

  docsUrl: process.env.NEXT_PUBLIC_THRU_DOCS_URL ?? 'https://docs.thru.org',
  // The Thru faucet is an on-chain program claimed with the `thru` CLI.
  devkitDocsUrl:
    process.env.NEXT_PUBLIC_THRU_DEVKIT_DOCS_URL ??
    'https://docs.thru.org/program-development/setting-up-thru-devkit',

  // Amount to request per faucet withdraw (base units; CLI caps at 10000/tx).
  faucetAmount: Number(process.env.NEXT_PUBLIC_FAUCET_AMOUNT ?? '10000'),
  faucetAmountLabel: process.env.NEXT_PUBLIC_FAUCET_AMOUNT_LABEL ?? '10,000 units',

  // Program addresses — blank means the corresponding feature runs in a
  // clearly-labelled preview / disabled state instead of failing hard.
  tokenProgramAddress: process.env.NEXT_PUBLIC_TOKEN_PROGRAM_ADDRESS ?? '',
  nameServiceProgramAddress:
    process.env.NEXT_PUBLIC_NAME_SERVICE_PROGRAM_ADDRESS ?? '',
  programLoaderAddress: process.env.NEXT_PUBLIC_PROGRAM_LOADER_ADDRESS ?? '',
} as const;

export function isTokenProgramConfigured(): boolean {
  return thruConfig.tokenProgramAddress.trim().length > 0;
}

export function isNameServiceConfigured(): boolean {
  return thruConfig.nameServiceProgramAddress.trim().length > 0;
}

export function isProgramLoaderConfigured(): boolean {
  return thruConfig.programLoaderAddress.trim().length > 0;
}
