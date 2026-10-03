# Thru Onboard

Thru Onboard is an unofficial community onboarding dApp for Thru Betanet. It
guides a new user through creating an account, claiming test THRU, launching a
simple fungible token, and reviewing the result.

The app is built with Next.js 14, TypeScript, Tailwind CSS, and Thru's official
web packages. Keys are generated and transactions are signed in the browser.

> **Betanet only.** Test tokens have no monetary value, and network state may
> be reset. Never use an account created here for real assets.

## What the app does

1. **Create or import a wallet**
   - Does not generate a key until the user clicks Create wallet.
   - Restores a returning wallet from a 64-character hexadecimal private key.
   - Shows the Thru `ta...` address.
   - Requires new users to download a JSON key backup before continuing.
   - Offers optional WebAuthn passkey registration.
2. **Claim test THRU**
   - Creates the account on-chain when necessary.
   - Submits the current faucet program's `withdraw` instruction from the browser.
   - Claims up to 10,000 base units when the faucet vault has a balance.
   - If that vault account is missing or empty, says so. The public ThruScan faucet still serves Alphanet, so the wizard does not link it.
3. **Launch a Simple Token**
   - Initializes a Token Program mint.
   - Initializes the owner's deterministic token account.
   - Mints an initial supply of 1,000,000 tokens to that account.
   - Shows the mint and token-account addresses in the explorer.
4. **Use the token and the name service**
   - Mints more supply, burns tokens, freezes or thaws the token account, and closes it once the balance is zero.
   - Sends tokens from the wallet to a Thru address or an existing token account.
   - Registers a name-service root and a name under it. The paid `.thru` registry is not initialized on Betanet, so the wizard does not sell domains.
5. **Use the wallet**
   - Shows the native THRU balance and each launched token balance in the header.
   - Sends tokens to a Thru address or an existing token account.
   - Creates the recipient's default token account when they do not have one yet.
6. **Review the result**
   - Summarizes the account, token, and name.
   - Provides copy controls and explorer links.

## Thru integration

The implementation follows Thru's documented account and transaction model:

- The official Token Program owns two relevant account types:
  `TokenMintAccount`, which stores token-wide configuration and supply, and
  `TokenAccount`, which stores an owner's balance for one mint.
- Token creation uses the documented `initialize_mint`, `initialize_account`,
  and `mint_to` instruction sequence.
- Mint addresses are derived from the mint authority and a seed. Token-account
  addresses are derived from the owner, mint, and seed.
- New mint, token, account, and name-service accounts use creating state
  proofs before their initialization transactions are submitted.
- Transaction account indices are resolved against the final sorted account
  list by the official SDK builders.

Official references:

- [Thru documentation](https://thru.org/docs/)
- [Set up the Thru DevKit and CLI](https://thru.org/docs/program-development/setting-up-thru-devkit/)
- [Token Program](https://thru.org/docs/core-programs/token-program/)
- [`@thru/programs`](https://thru.org/docs/sdks/web-packages/programs/)
- [Thru Explorer](https://scan.thru.org/)

## Technology

- Next.js 14 with the App Router
- React 18 and TypeScript
- Tailwind CSS and Radix UI
- `@thru/sdk` for RPC, keys, state proofs, transaction construction, signing,
  submission, and tracking
- `@thru/programs/token` for token address derivation and instruction builders
- `@thru/passkey` for optional WebAuthn support

## Run locally

Requirements:

- Node.js 18.18 or newer
- npm

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Available checks:

```bash
npm run typecheck
npm run lint
npm run build
```

## Configuration

The defaults target Thru Betanet.

| Variable | Purpose | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_THRU_RPC_URL` | Browser RPC endpoint | `https://rpc.betanet.thru.org` |
| `NEXT_PUBLIC_THRU_EXPLORER_URL` | Explorer base URL | `https://scan.thru.org` |
| `NEXT_PUBLIC_THRU_NETWORK` | Network label | `Betanet` |
| `NEXT_PUBLIC_THRU_CHAIN_ID` | Transaction chain ID | `2` |
| `NEXT_PUBLIC_FAUCET_AMOUNT` | Requested faucet amount in base units | `10000` |
| `NEXT_PUBLIC_FAUCET_PROGRAM_ADDRESS` | Faucet program | `taFCTxR0y2eabGGaEdtTwC9pHz7ZY4CYD7FOiBFUJeAW16` |
| `NEXT_PUBLIC_FAUCET_VAULT_ADDRESS` | Faucet vault | `taTigKYAf5mNxUNUVXeXq1HQodKc07DBzF4Pl7tCi1iXxt` |
| `NEXT_PUBLIC_COMMUNITY_FAUCET_URL` | Optional backup web faucet | unset |
| `NEXT_PUBLIC_TOKEN_PROGRAM_ADDRESS` | Token Program address | `taTOKENKRgcl3vO0yVhftATDbXuhgWcfaaxv9xpEEdMdUE` |
| `NEXT_PUBLIC_NAME_SERVICE_PROGRAM_ADDRESS` | Name Service Program address | `taNAMEqRNEDeMWp0cDYmMVdZyTZiF5NyGDR9zTwH42rWQG` |

See [`.env.example`](./.env.example) for optional server-side faucet gateway
and relayer settings.

## Security notes

- Private keys are generated and used client-side.
- A private key is not sent to the app's server or the faucet.
- The wizard stores its state, including the testnet key, in browser
  `localStorage` so a refresh does not lose progress.
- Anyone with the downloaded key backup or browser-stored private key controls
  the account.
- **Start over** clears the saved wizard state from the current browser.
- This design is appropriate only for an experimental testnet onboarding tool.

## Deployment

The app can run on Vercel or any Node.js host:

```bash
npm run build
npm run start
```

For Vercel, import the GitHub repository, add any required values from
`.env.example`, and deploy. The primary browser faucet path does not require a
server-side operator key.

## Project layout

```text
app/                         Next.js routes and global styles
components/layout/           Header, footer, logo, and theme controls
components/ui/               Shared UI primitives
components/wizard/           Wizard state, navigation, and step screens
lib/thru/account.ts          Account balance and nonce reads
lib/thru/client.ts           Thru RPC client
lib/thru/deploy.ts           Simple Token launch flow
lib/thru/faucet-onchain.ts   Account creation and official faucet transaction
lib/thru/nameservice*.ts     Name derivation and registration
lib/thru/keys.ts             Browser key generation and backup
lib/thru/explorer.ts         Explorer URL helpers
```

## Status

Thru documentation and Betanet behavior are evolving. This repository pins
the Thru web packages to `0.2.39` and retargets them at the Betanet program
addresses. Revalidate instruction layouts when upgrading those packages.
