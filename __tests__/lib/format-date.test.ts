import { afterEach, describe, expect, it, vi } from 'vitest';
import { formatDate, formatPeriod, MONTH_NAMES, yearOptions } from '@/lib/format-date';

describe('formatDate', () => {
  it('formats an ISO date as "Month D, YYYY"', () => {
    expect(formatDate('2026-07-09')).toBe('July 9, 2026');
  });

  it('drops the leading zero on the day', () => {
    expect(formatDate('2026-01-01')).toBe('January 1, 2026');
  });

  it('handles December (last month index)', () => {
    expect(formatDate('2025-12-31')).toBe('December 31, 2025');
  });
});

describe('formatPeriod', () => {
  it('formats a YYYY-MM period as "Month YYYY"', () => {
    expect(formatPeriod('2026-07')).toBe('July 2026');
  });

  it('handles January and December boundaries', () => {
    expect(formatPeriod('2026-01')).toBe('January 2026');
    expect(formatPeriod('2026-12')).toBe('December 2026');
  });
});

describe('MONTH_NAMES', () => {
  it('lists all twelve months in order', () => {
    expect(MONTH_NAMES).toHaveLength(12);
    expect(MONTH_NAMES[0]).toBe('January');
    expect(MONTH_NAMES[11]).toBe('December');
  });
});

describe('yearOptions', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns next year through five years back, newest first', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-19T00:00:00Z'));
    expect(yearOptions()).toEqual([2027, 2026, 2025, 2024, 2023, 2022, 2021]);
  });

  it('always returns seven descending years', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2030-01-01T00:00:00Z'));
    const years = yearOptions();
    expect(years).toHaveLength(7);
    expect(years[0]).toBe(2031);
    expect(years[6]).toBe(2025);
    for (let i = 1; i < years.length; i++) {
      expect(years[i]).toBeLessThan(years[i - 1]);
    }
  });
});
