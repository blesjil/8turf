import { describe, expect, it } from 'vitest';
import { anchorDueDate, chargeStatus } from '@/lib/reports/charges';

describe('anchorDueDate', () => {
  it('uses the lease start day-of-month within the given period', () => {
    expect(anchorDueDate('2026-07-15', '2026-08')).toBe('2026-08-15');
    expect(anchorDueDate('2026-01-01', '2026-08')).toBe('2026-08-01');
  });

  it('clamps to the last day when the anchor day overflows a shorter month', () => {
    // 31st anchor in February clamps to Feb 28 (2026 is not a leap year).
    expect(anchorDueDate('2026-01-31', '2026-02')).toBe('2026-02-28');
    // 31st anchor in April (30 days) clamps to Apr 30.
    expect(anchorDueDate('2026-01-31', '2026-04')).toBe('2026-04-30');
  });

  it('handles a leap-year February', () => {
    expect(anchorDueDate('2024-01-30', '2024-02')).toBe('2024-02-29');
  });
});

describe('chargeStatus', () => {
  const base = { amount: 100000, dueDate: '2026-08-15', asOf: '2026-08-20' };

  it('is paid when credits cover the charge', () => {
    expect(chargeStatus({ ...base, creditsApplied: 100000 })).toBe('paid');
    expect(chargeStatus({ ...base, creditsApplied: 120000 })).toBe('paid');
  });

  it('is advance when fully paid before the due date', () => {
    expect(chargeStatus({ ...base, creditsApplied: 100000, latestPaidDate: '2026-08-10' })).toBe(
      'advance',
    );
  });

  it('is partial when some but not all is paid', () => {
    expect(chargeStatus({ ...base, creditsApplied: 40000 })).toBe('partial');
  });

  it('is not_due when nothing is paid and the due date is still in the future', () => {
    // as-of Aug 5, due Aug 15 -> not yet due (the mid-month false-unpaid fix)
    expect(chargeStatus({ ...base, asOf: '2026-08-05', creditsApplied: 0 })).toBe('not_due');
  });

  it('is unpaid when nothing is paid and it is due today', () => {
    expect(chargeStatus({ ...base, asOf: '2026-08-15', creditsApplied: 0 })).toBe('unpaid');
  });

  it('is overdue when nothing is paid past the due date', () => {
    expect(chargeStatus({ ...base, asOf: '2026-08-20', creditsApplied: 0 })).toBe('overdue');
  });

  it('treats a zero-rent charge as paid (never falsely unpaid)', () => {
    expect(chargeStatus({ ...base, amount: 0, creditsApplied: 0 })).toBe('paid');
  });
});
