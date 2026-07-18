import { NextRequest, NextResponse } from 'next/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const execFileP = promisify(execFile);

// --- Optional HTTP faucet gateway (a service you run that dispenses tokens). ---
const FAUCET_URL = process.env.FAUCET_URL ?? '';

// --- Built-in faucet relayer using the official `thru` CLI. ------------------
// When you give the server a funded operator key + a path to the `thru` binary,
// the route claims from Thru's on-chain faucet on the user's behalf: the
// operator pays the tx fee and the tokens are sent to the user's address. This
// is exactly how the CLI's `thru faucet withdraw <address> <amount>` works.
const CLI_BIN = process.env.THRU_CLI_BIN ?? ''; // e.g. "thru" (on PATH) or an absolute path
const OPERATOR_KEY = process.env.THRU_FAUCET_OPERATOR_KEY ?? ''; // 64-hex funded key (server secret)
const SERVER_RPC =
  process.env.THRU_RPC_URL ?? process.env.NEXT_PUBLIC_THRU_RPC_URL ?? 'https://rpc.alphanet.thru.org';
const AMOUNT = String(
  process.env.THRU_FAUCET_AMOUNT ?? process.env.NEXT_PUBLIC_FAUCET_AMOUNT ?? '10000',
);

const RATE_LIMIT = Number(process.env.FAUCET_RATE_LIMIT_PER_HOUR ?? '3');

// Loose address sanity check (Thru addresses are ta… base-encoded strings).
const ADDRESS_RE = /^ta[A-Za-z0-9_-]{20,}$/;

function relayerConfigured(): boolean {
  return CLI_BIN.length > 0 && OPERATOR_KEY.length > 0;
}

function gatewayConfigured(): boolean {
  return FAUCET_URL.length > 0;
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
}

/**
 * Lets the client discover whether one-click funding is available for this
 * deployment (either a built-in CLI relayer or an HTTP gateway). When neither
 * is set, the UI shows the guided `thru` CLI steps instead.
 */
export async function GET() {
  return NextResponse.json({ configured: relayerConfigured() || gatewayConfigured() });
}

export async function POST(req: NextRequest) {
  let address = '';
  try {
    const body = (await req.json()) as { address?: string };
    address = (body.address ?? '').trim();
  } catch {
    return NextResponse.json({ ok: false, message: 'Invalid request body.' }, { status: 400 });
  }

  if (!ADDRESS_RE.test(address)) {
    return NextResponse.json(
      { ok: false, message: 'That does not look like a valid Thru address.' },
      { status: 400 },
    );
  }

  // Rate limit by IP.
  const ip = clientIp(req);
  const rl = checkRateLimit(`faucet:${ip}`, RATE_LIMIT);
  if (!rl.allowed) {
    const mins = Math.ceil(rl.retryAfterSeconds / 60);
    return NextResponse.json(
      {
        ok: false,
        message: `Faucet limit reached (${RATE_LIMIT}/hour). Try again in about ${mins} minute${
          mins === 1 ? '' : 's'
        }.`,
        retryAfter: rl.retryAfterSeconds,
      },
      { status: 429 },
    );
  }

  // 1) Preferred: built-in relayer via the official `thru` CLI.
  if (relayerConfigured()) {
    return claimViaCli(address);
  }

  // 2) Optional: forward to an external HTTP faucet gateway.
  if (gatewayConfigured()) {
    return claimViaGateway(address);
  }

  // 3) No server-side funding: the UI falls back to the guided CLI steps.
  return NextResponse.json({
    ok: false,
    manual: true,
    message:
      'One-click funding is not configured for this deployment. Use the guided Thru CLI steps to claim from the faucet.',
  });
}

/**
 * Runs `thru faucet withdraw <address> <amount>` server-side, paying the fee
 * from a funded operator key. The operator key stays on the server.
 */
async function claimViaCli(address: string) {
  try {
    const home = path.join(os.tmpdir(), 'thru-faucet-relayer');
    fs.mkdirSync(home, { recursive: true });
    const env = { ...process.env, HOME: home };

    // Ensure the operator key exists in the CLI config (idempotent).
    await execFileP(
      CLI_BIN,
      ['keys', 'add', 'operator', OPERATOR_KEY, '--overwrite', '--quiet'],
      { env, timeout: 15_000 },
    ).catch(() => {
      /* key may already exist; withdraw will surface any real problem */
    });

    const { stdout } = await execFileP(
      CLI_BIN,
      [
        'faucet',
        'withdraw',
        address,
        AMOUNT,
        '--fee-payer',
        'operator',
        '--url',
        SERVER_RPC,
        '--json',
        '--quiet',
      ],
      { env, timeout: 60_000 },
    );

    const result = parseCliJson(stdout);
    if (result.ok) {
      return NextResponse.json({
        ok: true,
        message: 'Test tokens are on the way! They should arrive within a few seconds.',
        signature: result.signature,
      });
    }
    return NextResponse.json(
      { ok: false, message: result.error ?? 'The faucet claim failed. Please try again shortly.' },
      { status: 502 },
    );
  } catch (err) {
    // execFile throws on non-zero exit; the CLI usually still printed JSON.
    const stdout = (err as { stdout?: string })?.stdout ?? '';
    const result = parseCliJson(stdout);
    return NextResponse.json(
      {
        ok: false,
        message:
          result.error ??
          'Could not run the faucet relayer. Check the server’s Thru CLI + operator key configuration.',
      },
      { status: 502 },
    );
  }
}

interface CliResult {
  ok: boolean;
  signature?: string;
  error?: string;
}

/** Parse the CLI's --json output for success/signature or an error message. */
function parseCliJson(stdout: string): CliResult {
  const lines = stdout
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  // The relevant JSON object is usually the last well-formed line.
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const obj = JSON.parse(lines[i]) as Record<string, unknown>;
      const fw = (obj.faucet_withdraw ?? obj) as Record<string, unknown>;
      const status = String(fw.status ?? '');
      const signature =
        (fw.signature as string) ?? (fw.tx_hash as string) ?? (fw.transaction as string);
      const errObj = (obj.error ?? fw.error) as { message?: string } | string | undefined;
      const error = typeof errObj === 'string' ? errObj : errObj?.message;
      if (status === 'success' || signature) return { ok: true, signature };
      if (error) return { ok: false, error };
    } catch {
      /* not JSON — keep scanning */
    }
  }
  return { ok: false, error: undefined };
}

/** Forward to an external HTTP faucet gateway the operator runs. */
async function claimViaGateway(address: string) {
  try {
    const upstream = await fetch(FAUCET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
      signal: AbortSignal.timeout(20_000),
    });

    let data: Record<string, unknown> = {};
    try {
      data = (await upstream.json()) as Record<string, unknown>;
    } catch {
      /* non-JSON */
    }

    if (!upstream.ok) {
      return NextResponse.json(
        {
          ok: false,
          message:
            (data.message as string) ??
            `Faucet responded with HTTP ${upstream.status}. It may be rate limited or down.`,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      message: 'Test tokens are on the way! They should arrive within a few seconds.',
      signature: (data.signature as string) ?? (data.txHash as string) ?? undefined,
    });
  } catch {
    return NextResponse.json(
      { ok: false, message: 'Could not reach the faucet gateway. Please try again shortly.' },
      { status: 502 },
    );
  }
}
