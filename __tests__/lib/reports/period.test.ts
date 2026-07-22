import { describe, expect, it } from 'vitest';
import { monthBounds, periodsInRange } from '@/lib/reports/period';

describe('monthBounds', () => {
  it('returns inclusive start and exclusive end', () => {
    expect(monthBounds('2026-07')).toEqual({ start: '2026-07-01', endExclusive: '2026-08-01' });
  });

  it('rolls over the year in December', () => {
    expect(monthBounds('2026-12')).toEqual({ start: '2026-12-01', endExclusive: '2027-01-01' });
  });
});

describe('periodsInRange', () => {
  it('yields a single period when from equals to', () => {
    expect(periodsInRange('2026-07', '2026-07')).toEqual(['2026-07']);
  });

  it('yields every month inclusive, across a year boundary', () => {
    expect(periodsInRange('2026-11', '2027-02')).toEqual([
      '2026-11',
      '2026-12',
      '2027-01',
      '2027-02',
    ]);
  });
});
