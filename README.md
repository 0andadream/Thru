# Thru Onboard

> **Get started on Thru in 60 seconds.** A clean, wizard-style dApp that walks
> non-technical users through creating an account, getting test tokens,
> deploying a program, and claiming a name on the **Thru** blockchain
> (Alphanet / testnet).

Built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**,
**Radix UI**, and the official **[`@thru/sdk`](https://www.npmjs.com/package/@thru/sdk)**
family of packages. All key generation and signing happens **client-side only** —
private keys never touch a server.

---

## ✨ Features

- **6-step guided wizard** with a clickable progress stepper and per-step
  animations.
  1. **Welcome** — hero + "Start now".
  2. **Create Account** — Ed25519 keypair generated in the browser, public
     address shown, one-click JSON keystore download + copy, repeated backup
     warnings, and **optional passkey** registration (WebAuthn).
  3. **Get Tokens** — one-click faucet drip (via a rate-limited server proxy)
     with live balance polling.
  4. **Deploy Program** — choose **Simple Token**, **Counter**, or **Hello
     World**; deploy in one click and see the resulting **Meta + Buffer**
     addresses.
  5. **Claim a Name** — root name with auto-suggestions, subdomain
     (`alice.yourname`), and optional URL / Twitter / linked-pubkey records.
  6. **Success Dashboard** — summary of everything created, explorer links,
     "Start over" / "Do more", and confetti 🎉.
- **Beautiful, modern UI** — futuristic blue→green palette, aurora background,
  glass cards, **dark mode** (default) + light mode, fully **mobile
  responsive**.
- **Copy buttons and explorer links everywhere.**
- **Advanced mode toggle** exposing RPC host + chain id.
- **Client-side only keys** with strong, repeated backup warnings.
- **Faucet rate limiting** (per-IP sliding window) in the server route.
- **Testnet disclaimers** in the footer (tokens have no value).
- **Progress persistence** — refresh mid-flow without losing your new account.

---

## 🚀 Quick start (local)

```bash
# 1. Install dependencies
npm install

# 2. Configure your network (optional — sensible Alphanet defaults are built in)
cp .env.example .env.local
#   edit .env.local as needed

# 3. Run the dev server
npm run dev
# open http://localhost:3000
```

Other scripts:

```bash
npm run build      # production build
npm run start      # serve the production build
npm run typecheck  # tsc --noEmit
npm run lint       # next lint
```

Requires **Node 18.18+** (Node 20+ recommended).

---

## 🔧 Configuration

Everything network-specific is read from environment variables — see
[`.env.example`](./.env.example) for the full, documented list. The most common:

| Variable | Purpose | Default |
| --- | --- | --- |
| `NEXT_PUBLIC_THRU_RPC_URL` | RPC endpoint the browser talks to | `https://rpc.alphanet.thru.org` |
| `NEXT_PUBLIC_THRU_EXPLORER_URL` | Block explorer base URL | `https://explorer.alphanet.thru.org` |
| `NEXT_PUBLIC_THRU_NETWORK` | Display name | `Alphanet` |
| `FAUCET_URL` | Faucet endpoint (server-side, proxied) | _(blank → manual mode)_ |
| `FAUCET_RATE_LIMIT_PER_HOUR` | Faucet requests per IP per hour | `3` |
| `NEXT_PUBLIC_TOKEN_PROGRAM_ADDRESS` | Token program address (enables real token mint) | _(blank → preview)_ |
| `NEXT_PUBLIC_NAME_SERVICE_PROGRAM_ADDRESS` | Name Service program address | _(blank → preview)_ |
| `NEXT_PUBLIC_PROGRAM_LOADER_ADDRESS` | Program loader (enables Counter / Hello World deploy) | _(blank → preview)_ |

### On-chain vs. preview mode

This tool ships wired to the real Thru SDK. Some actions require a
network-specific **program address** that isn't hard-coded in the SDK:

- **Account creation & signing** — always real (client-side Ed25519).
- **Faucet & balance** — real as soon as `FAUCET_URL` is set; balances read
  from live RPC.
- **Simple Token deploy** — a **real on-chain token mint** (via
  `@thru/programs/token`) as soon as `NEXT_PUBLIC_TOKEN_PROGRAM_ADDRESS` is set.
- **Counter / Hello World deploy** and **Name Service** — real once their
  program addresses (and, for programs, compiled binaries in
  [`public/programs/`](./public/programs/README.md)) are configured.

When a required address is not configured, that step runs in a clearly-labelled
**Preview** mode: it uses the SDK's **real** address-derivation primitives to
show and let users copy the genuine addresses the action would occupy, without
submitting a transaction. Every preview surface is badged so nothing is
misleading. Plug in the addresses for your network to flip them to live.

---

## ☁️ Deploy to Vercel

1. Push this repo to GitHub.
2. In [Vercel](https://vercel.com/new), **Import** the repo (framework:
   **Next.js** — auto-detected).
3. Add your environment variables (Project → Settings → Environment
   Variables) from `.env.example`.
4. **Deploy.**

The faucet route (`/api/faucet`) runs on the Node.js runtime. The in-memory
rate limiter is per-serverless-instance and best-effort; for production-grade
protection back it with a shared store (e.g. Upstash Redis) or add a CAPTCHA.

You can also deploy anywhere that runs a Next.js server (`npm run build && npm
run start`).

---

## 🗂️ Project structure

```
app/
  layout.tsx            # Root layout, fonts, theme + toast providers
  page.tsx              # Wizard shell (header, aurora bg, footer)
  globals.css           # Tailwind + design tokens (light/dark)
  icon.svg              # Favicon
  api/faucet/route.ts   # Rate-limited faucet proxy (server-side)

components/
  ui/                   # Button, Card, Input, Progress, Switch, Badge,
                        # Tooltip, Toast, CopyButton, Spinner
  layout/               # Header, Footer, Logo, ThemeToggle
  wizard/
    wizard.tsx          # Step orchestrator
    wizard-context.tsx  # useReducer state + localStorage persistence
    stepper.tsx         # Progress stepper (desktop + mobile)
    step-parts.tsx      # Shared step primitives (headings, address rows, nav)
    advanced-toggle.tsx
    steps/              # welcome, create-account, fund, deploy, name, success

lib/
  utils.ts              # cn(), hex helpers, formatting
  confetti.ts           # celebration effects
  storage.ts            # safe localStorage wrapper
  rate-limit.ts         # sliding-window limiter for the faucet route
  thru/
    config.ts           # env-driven chain config
    client.ts           # memoised Thru RPC client
    keys.ts             # keypair gen, keystore download, private-key export
    account.ts          # balance snapshot + waitForFunds polling
    transactions.ts     # build → sign (local) → submit → track helper
    faucet.ts           # client wrapper for /api/faucet
    deploy.ts           # deploy catalog + token mint + preview derivation
    nameservice.ts      # name derivation + registration
    passkey.ts          # WebAuthn passkey registration
    explorer.ts         # explorer URL helpers
    types.ts            # shared types

public/programs/        # drop compiled program binaries here (see README)
```

---

## 🔒 Security

- **Keys are generated and used entirely in the browser.** The private key is
  never sent to, or stored on, any server. The faucet route only ever receives
  your **public** address.
- Users are **prompted to download a JSON keystore backup** and cannot advance
  past step 1 until they do.
- The private key is masked by default and only revealed on explicit tap.
- Wizard progress (including the freshly-created account) is stored in
  `localStorage` so a refresh doesn't lose it. This is appropriate for a
  **testnet** onboarding tool; clear your browser storage or hit **Start over**
  to wipe it.
- Passkeys (WebAuthn) are offered as an **optional** convenience layer.
- The faucet route is **rate limited** per IP.

> ⚠️ **Testnet only.** Test tokens have no monetary value and the network may be
> reset at any time. Never send real funds to addresses created here. This is an
> unofficial community tool.

---

## 📦 Thru packages used

- [`@thru/sdk`](https://www.npmjs.com/package/@thru/sdk) — RPC client, keypair
  generation, transaction building/signing, address derivation.
- [`@thru/programs`](https://www.npmjs.com/package/@thru/programs) — on-chain
  token program instruction builders.
- [`@thru/passkey`](https://www.npmjs.com/package/@thru/passkey) — WebAuthn
  passkey helpers.

---

## 🔗 Links

- Docs: <https://docs.thru.org>
- Explorer: configured via `NEXT_PUBLIC_THRU_EXPLORER_URL`
- RPC: configured via `NEXT_PUBLIC_THRU_RPC_URL`

---

Built for the Thru community. MIT-style use — adapt freely for your network.
