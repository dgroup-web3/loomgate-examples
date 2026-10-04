import { describe, expect, it } from 'vitest';
import { formatAmount, parseAmount, toMajorInput } from './money';

describe('parseAmount', () => {
  it.each([
    ['12.50', 1250],
    ['12.5', 1250],
    ['12', 1200],
    ['0.5', 50],
    [' 3,25 ', 325],
    ['1,000.00', null],
    ['', null],
    ['-1', null],
    ['1.234', null],
    ['abc', null],
    ['999999.99', 99999999],
    ['1000000', null],
  ])('%j → %j', (input, expected) => {
    expect(parseAmount(input)).toBe(expected);
  });
});

describe('formatAmount', () => {
  it('formats minor units in the currency', () => {
    expect(formatAmount(1250, 'usd')).toBe('$12.50');
    expect(formatAmount(1250, 'eur')).toBe('€12.50');
  });
});

describe('toMajorInput', () => {
  it('turns minor units back into what a person types', () => {
    expect(toMajorInput(1250)).toBe('12.50');
    expect(toMajorInput(5)).toBe('0.05');
  });
});
