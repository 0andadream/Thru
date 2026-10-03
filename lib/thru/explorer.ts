import { thruConfig } from './config';

function base(): string {
  return thruConfig.explorerUrl.replace(/\/$/, '');
}

/** scan.thru.org uses the rpc query param to select which network to read. */
function rpcQuery(): string {
  return `?rpc=${encodeURIComponent(thruConfig.rpcUrl)}`;
}

export function accountUrl(address: string): string {
  return `${base()}/address/${address}${rpcQuery()}`;
}

export function txUrl(signature: string): string {
  return `${base()}/tx/${signature}${rpcQuery()}`;
}

export function programUrl(address: string): string {
  return `${base()}/address/${address}${rpcQuery()}`;
}
