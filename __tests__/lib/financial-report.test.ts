import { describe, it, expect } from 'vitest';
import {
  buildPropertyGroups,
  summarizeFinancialReport,
  type UnitRow,
} from '@/lib/financial-report';

const rows: UnitRow[] = [
  { propertyId: 'p1', propertyName: 'Residences', unitId: 'u1', unitLabel: 'Room 1' },
  { propertyId: 'p1', propertyName: 'Residences', unitId: 'u2', unitLabel: 'Room 2' },
  { propertyId: 'p2', propertyName: 'Commercial', unitId: 'u3', unitLabel: 'Stall X' },
];

describe('buildPropertyGroups', () => {
  it('groups units by property and derives per-property totals', () => {
    const groups = buildPropertyGroups(
      rows,
      new Map([
        ['u1', 6000],
        ['u2', 4000],
        ['u3', 6000],
      ]),
      new Map([['u3', 100]]),
      new Map([['p1', 500]]),
    );

    expect(groups).toHaveLength(2);

    const p1 = groups.find((g) => g.propertyId === 'p1')!;
    expect(p1.units).toHaveLength(2);
    expect(p1.propertyExpenses).toBe(500);
    expect(p1.totalIncome).toBe(10000);
    expect(p1.totalExpenses).toBe(500); // no unit expenses + property-level
    expect(p1.netIncome).toBe(9500);

    const p2 = groups.find((g) => g.propertyId === 'p2')!;
    expect(p2.propertyExpenses).toBe(0);
    expect(p2.totalIncome).toBe(6000);
    expect(p2.totalExpenses).toBe(100); // unit expense, no property-level
    expect(p2.netIncome).toBe(5900);
  });

  it('defaults missing income and expenses to zero', () => {
    const groups = buildPropertyGroups(rows.slice(0, 1), new Map(), new Map(), new Map());
    expect(groups[0].units[0]).toMatchObject({ income: 0, expenses: 0 });
    expect(groups[0].totalIncome).toBe(0);
    expect(groups[0].totalExpenses).toBe(0);
    expect(groups[0].netIncome).toBe(0);
  });

  it('preserves unit labels and ids', () => {
    const groups = buildPropertyGroups(rows.slice(0, 1), new Map(), new Map(), new Map());
    expect(groups[0].units[0]).toMatchObject({ unitId: 'u1', unitLabel: 'Room 1' });
  });

  it('returns an empty array for no rows', () => {
    expect(buildPropertyGroups([], new Map(), new Map(), new Map())).toEqual([]);
  });
});

describe('summarizeFinancialReport', () => {
  it('sums gross income and expenses across properties and derives net', () => {
    const groups = buildPropertyGroups(
      rows,
      new Map([
        ['u1', 6000],
        ['u3', 6000],
      ]),
      new Map([['u3', 100]]),
      new Map(),
    );
    expect(summarizeFinancialReport(groups)).toEqual({
      grossIncome: 12000,
      totalExpenses: 100,
      netIncome: 11900,
    });
  });

  it('returns zeros for no groups', () => {
    expect(summarizeFinancialReport([])).toEqual({
      grossIncome: 0,
      totalExpenses: 0,
      netIncome: 0,
    });
  });

  it('reports a negative net income when expenses exceed income', () => {
    const groups = buildPropertyGroups(
      rows.slice(0, 1),
      new Map([['u1', 1000]]),
      new Map([['u1', 4000]]),
      new Map(),
    );
    expect(summarizeFinancialReport(groups).netIncome).toBe(-3000);
  });
});
