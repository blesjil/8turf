import { describe, expect, it } from 'vitest';
import { centsFromFormData, dollarsToCents, formatCents } from '@/lib/money';

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

  it('handles a leading zero decimal', () => {
    expect(dollarsToCents('0.99')).toBe(99);
  });

  it('returns NaN for non-numeric input', () => {
    expect(dollarsToCents('abc')).toBeNaN();
    expect(dollarsToCents('')).toBeNaN();
  });
});

describe('centsFromFormData', () => {
  it('uses the visible dollar field as the authoritative value', () => {
    const formData = new FormData();
    formData.set('amount', '0');
    formData.set('amountDollars', '12500');

    expect(centsFromFormData(formData, 'amount', 'amountDollars')).toBe(1_250_000);
  });

  it('falls back to the cents field when the visible field is absent', () => {
    const formData = new FormData();
    formData.set('amount', '500000');

    expect(centsFromFormData(formData, 'amount', 'amountDollars')).toBe('500000');
  });
});

describe('formatCents', () => {
  it('formats cents as a peso string with two decimals', () => {
    expect(formatCents(150000)).toBe('₱ 1,500.00');
  });

  it('formats zero', () => {
    expect(formatCents(0)).toBe('₱ 0.00');
  });

  it('formats sub-peso amounts', () => {
    expect(formatCents(5)).toBe('₱ 0.05');
    expect(formatCents(99)).toBe('₱ 0.99');
  });

  it('groups thousands with commas', () => {
    expect(formatCents(123456789)).toBe('₱ 1,234,567.89');
  });

  it('keeps the space after the symbol for negative amounts', () => {
    // Refunds/adjustments can be negative; the symbol-spacing regex must still apply.
    expect(formatCents(-150000)).toBe('-₱ 1,500.00');
  });
});
