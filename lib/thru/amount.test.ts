import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDisplayAmount } from './amount';

test('parses whole and fractional token amounts', () => {
  assert.equal(parseDisplayAmount('1', 6), 1_000_000n);
  assert.equal(parseDisplayAmount('1.5', 6), 1_500_000n);
  assert.equal(parseDisplayAmount('0.000001', 6), 1n);
  assert.equal(parseDisplayAmount('10', 0), 10n);
});

test('rejects empty, extra precision, and zero', () => {
  assert.throws(() => parseDisplayAmount('', 6), /token amount/);
  assert.throws(() => parseDisplayAmount('1.2', 0), /decimal places/);
  assert.throws(() => parseDisplayAmount('0.0000001', 6), /decimal places/);
  assert.throws(() => parseDisplayAmount('0', 6), /greater than zero/);
  assert.throws(() => parseDisplayAmount('1.2.3', 6), /token amount/);
});
