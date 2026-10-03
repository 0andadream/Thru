/** One-shot flag so Import wallet can open the form without creating a key. */
let openImport = false;
const listeners = new Set<() => void>();

export function requestWalletImport(): void {
  openImport = true;
  listeners.forEach((listener) => listener());
}

export function consumeWalletImport(): boolean {
  const value = openImport;
  openImport = false;
  return value;
}

/** Fires when Import wallet is requested, including if the wallet step is already open. */
export function subscribeWalletImport(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
