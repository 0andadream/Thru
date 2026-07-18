'use client';

/**
 * Client helper for the faucet. The actual outbound request is made by our own
 * server route (/api/faucet) which adds IP-based rate limiting and hides the
 * faucet URL behind the app. The private key is never involved — the faucet
 * only needs the destination address.
 */

export interface FaucetResponse {
  ok: boolean;
  /** Human-readable message to show the user. */
  message: string;
  /** Transaction signature, when the faucet returns one. */
  signature?: string;
  /** True when the server is not configured with a faucet URL (manual mode). */
  manual?: boolean;
  /** Seconds to wait before retrying, when rate limited. */
  retryAfter?: number;
}

export async function requestFaucet(address: string): Promise<FaucetResponse> {
  const res = await fetch('/api/faucet', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address }),
  });

  let data: Partial<FaucetResponse> = {};
  try {
    data = (await res.json()) as Partial<FaucetResponse>;
  } catch {
    /* non-JSON response */
  }

  if (res.status === 429) {
    return {
      ok: false,
      message: data.message ?? 'Too many faucet requests. Please wait a bit and try again.',
      retryAfter: data.retryAfter,
    };
  }

  if (!res.ok) {
    return {
      ok: false,
      message: data.message ?? `Faucet request failed (HTTP ${res.status}).`,
      manual: data.manual,
    };
  }

  return {
    ok: data.ok ?? true,
    message: data.message ?? 'Faucet request submitted.',
    signature: data.signature,
    manual: data.manual,
  };
}
