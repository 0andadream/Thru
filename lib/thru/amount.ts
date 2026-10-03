/** Convert a user-entered token amount into raw base units. */
export function parseDisplayAmount(input: string, decimals: number): bigint {
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error('This token has an unsupported decimal count.');
  }

  const trimmed = input.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error('Enter a token amount using digits and one decimal point.');
  }

  const [whole, fraction = ''] = trimmed.split('.');
  if (fraction.length > decimals) {
    throw new Error(
      decimals === 0
        ? 'This token does not use decimal places.'
        : `This token supports up to ${decimals} decimal places.`,
    );
  }

  const scale = 10n ** BigInt(decimals);
  const fractionRaw = decimals === 0 ? 0n : BigInt(fraction.padEnd(decimals, '0'));
  const raw = BigInt(whole) * scale + fractionRaw;
  if (raw <= 0n) throw new Error('Enter an amount greater than zero.');
  return raw;
}
