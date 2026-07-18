'use client';

import { createThruClient, type Thru } from '@thru/sdk';
import { thruConfig } from './config';

let cached: Thru | null = null;

/**
 * Returns a lazily-created, memoised Thru RPC client. The client talks to the
 * RPC endpoint directly from the browser over gRPC-web; no private key material
 * is ever involved here (signing happens locally before submission).
 */
export function getThru(): Thru {
  if (!cached) {
    cached = createThruClient({
      baseUrl: thruConfig.rpcUrl,
      transportOptions: {
        // The Thru RPC only accepts the binary gRPC-web format; the JSON
        // format is rejected with "invalid gRPC request content-type
        // application/grpc-web+json".
        useBinaryFormat: true,
        defaultTimeoutMs: 30_000,
      },
    });
  }
  return cached;
}
