import { describe, expect, it } from 'vitest';
import { dollarsToCents, formatCents } from '@/lib/money';

describe('dollarsToCents', () => {
  it('converts a whole dollar string to cents', () => {
    expect(dollarsToCents('1500')).toBe(150000);
  });

  it('converts a string with cents to the correct integer', () => {
    expect(dollarsToCents('1500.5')).toBe(150050);
  });

  it('rounds fractional cents', () => {
    expect(dollarsToCents('10.005')).toBe(1001);
  });
});

describe('formatCents', () => {
  it('formats cents as a peso string with two decimals', () => {
    expect(formatCents(150000)).toBe('₱ 1,500.00');
  });

  it('formats zero', () => {
    expect(formatCents(0)).toBe('₱ 0.00');
  });
});
