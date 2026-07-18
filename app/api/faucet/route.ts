import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit } from '@/lib/rate-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const FAUCET_URL = process.env.FAUCET_URL ?? '';
const RATE_LIMIT = Number(process.env.FAUCET_RATE_LIMIT_PER_HOUR ?? '3');

// Loose address sanity check (Thru addresses are ta… base-encoded strings).
const ADDRESS_RE = /^ta[A-Za-z0-9_-]{20,}$/;

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get('x-forwarded-for');
  if (fwd) return fwd.split(',')[0].trim();
  return req.headers.get('x-real-ip') ?? 'unknown';
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

  // Manual mode: no faucet URL configured for this deployment.
  if (!FAUCET_URL) {
    return NextResponse.json({
      ok: false,
      manual: true,
      message:
        'No faucet endpoint is configured for this deployment. Set FAUCET_URL to enable one-click funding, or use the official Thru faucet manually.',
    });
  }

  // Forward the drip request to the real faucet.
  try {
    const upstream = await fetch(FAUCET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address }),
      // Don't hang the route forever.
      signal: AbortSignal.timeout(20_000),
    });

    let data: Record<string, unknown> = {};
    try {
      data = (await upstream.json()) as Record<string, unknown>;
    } catch {
      /* faucet returned non-JSON */
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
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        message:
          'Could not reach the faucet endpoint. Please try again shortly or use the official Thru faucet.',
      },
      { status: 502 },
    );
  }
}
