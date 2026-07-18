'use client';

import type { PasskeyInfo } from './types';

/** Feature-detect WebAuthn without importing the SDK (keeps SSR happy). */
export function isPasskeySupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    !!navigator.credentials
  );
}

/**
 * Register a passkey for easier future signing. Uses the official
 * @thru/passkey WebAuthn helper. Purely additive — the account still works
 * with its downloaded private key regardless.
 */
export async function createPasskey(
  username: string,
  userId: string,
): Promise<PasskeyInfo> {
  if (!isPasskeySupported()) {
    throw new Error('Passkeys are not supported in this browser.');
  }
  const { registerPasskey } = await import('@thru/passkey/web');
  const rpId = window.location.hostname;
  const result = await registerPasskey(username, userId, rpId);

  // The result shape varies slightly by version; pull the credential id defensively.
  const credentialId =
    (result as { credentialId?: string })?.credentialId ??
    (result as { id?: string })?.id ??
    '';

  return { credentialId, createdAt: Date.now() };
}
