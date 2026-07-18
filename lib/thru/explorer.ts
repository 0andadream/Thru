import { thruConfig } from './config';

function base(): string {
  return thruConfig.explorerUrl.replace(/\/$/, '');
}

export function accountUrl(address: string): string {
  return `${base()}/account/${address}`;
}

export function txUrl(signature: string): string {
  return `${base()}/tx/${signature}`;
}

export function programUrl(address: string): string {
  return `${base()}/account/${address}`;
}
