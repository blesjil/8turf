import { describe, it, expect } from 'vitest';
import {
  buildPropertyGroups,
  calculateVacancyLostByUnit,
  reportPeriods,
  summarizeFinancialReport,
  type UnitRow,
} from '@/lib/financial-report';

const rows: UnitRow[] = [
  {
    propertyId: 'p1',
    propertyName: 'Residences',
    unitId: 'u1',
    unitLabel: 'Room 1',
    rentAmount: 1000,
    createdPeriod: '2025-01',
  },
  {
    propertyId: 'p1',
    propertyName: 'Residences',
    unitId: 'u2',
    unitLabel: 'Room 2',
    rentAmount: 2000,
    createdPeriod: '2025-01',
  },
  {
    propertyId: 'p2',
    propertyName: 'Commercial',
    unitId: 'u3',
    unitLabel: 'Stall X',
    rentAmount: 3000,
    createdPeriod: '2025-01',
  },
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
      new Map([
        ['u2', 2000],
        ['u3', 3000],
      ]),
    );

    expect(groups).toHaveLength(2);

    const p1 = groups.find((g) => g.propertyId === 'p1')!;
    expect(p1.units).toHaveLength(2);
    expect(p1.propertyExpenses).toBe(500);
    expect(p1.totalIncome).toBe(10000);
    expect(p1.totalExpenses).toBe(500); // no unit expenses + property-level
    expect(p1.totalVacancyLost).toBe(2000);
    expect(p1.netIncome).toBe(9500);

    const p2 = groups.find((g) => g.propertyId === 'p2')!;
    expect(p2.propertyExpenses).toBe(0);
    expect(p2.totalIncome).toBe(6000);
    expect(p2.totalExpenses).toBe(100); // unit expense, no property-level
    expect(p2.totalVacancyLost).toBe(3000);
    expect(p2.netIncome).toBe(5900);
  });

  it('defaults missing income and expenses to zero', () => {
    const groups = buildPropertyGroups(
      rows.slice(0, 1),
      new Map(),
      new Map(),
      new Map(),
      new Map(),
    );
    expect(groups[0].units[0]).toMatchObject({ income: 0, expenses: 0, vacancyLost: 0 });
    expect(groups[0].totalIncome).toBe(0);
    expect(groups[0].totalExpenses).toBe(0);
    expect(groups[0].netIncome).toBe(0);
  });

  it('preserves unit labels and ids', () => {
    const groups = buildPropertyGroups(
      rows.slice(0, 1),
      new Map(),
      new Map(),
      new Map(),
      new Map(),
    );
    expect(groups[0].units[0]).toMatchObject({ unitId: 'u1', unitLabel: 'Room 1' });
  });

  it('returns an empty array for no rows', () => {
    expect(buildPropertyGroups([], new Map(), new Map(), new Map(), new Map())).toEqual([]);
  });
});

describe('calculateVacancyLostByUnit', () => {
  it('charges asking rent when no lease covers the selected month', () => {
    expect(calculateVacancyLostByUnit(rows, [], ['2026-06'])).toEqual(
      new Map([
        ['u1', 1000],
        ['u2', 2000],
        ['u3', 3000],
      ]),
    );
  });

  it('returns zero for an occupied month and counts vacant months in a year', () => {
    const vacancy = calculateVacancyLostByUnit(
      rows.slice(0, 2),
      [
        {
          unitId: 'u1',
          leaseStartDate: '2026-01-15',
          leaseEndDate: '2026-11-10',
        },
        { unitId: 'u2', leaseStartDate: '2026-01-01', leaseEndDate: null },
      ],
      reportPeriods('year', '2026-01', '2026', '2026-12'),
    );
    expect(vacancy.get('u1')).toBe(1000);
    expect(vacancy.get('u2')).toBe(0);
  });

  it('does not count months before the unit existed', () => {
    const newUnit = { ...rows[0], createdPeriod: '2026-10' };
    expect(
      calculateVacancyLostByUnit(
        [newUnit],
        [],
        reportPeriods('year', '2026-01', '2026', '2026-12'),
      ).get('u1'),
    ).toBe(3000);
  });

  it('does not treat future months as already lost', () => {
    expect(reportPeriods('year', '2026-01', '2026', '2026-07')).toEqual([
      '2026-01',
      '2026-02',
      '2026-03',
      '2026-04',
      '2026-05',
      '2026-06',
      '2026-07',
    ]);
    expect(reportPeriods('month', '2026-08', '2026', '2026-07')).toEqual([]);
    expect(reportPeriods('year', '2027-01', '2027', '2026-07')).toEqual([]);
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
      new Map([
        ['u1', 500],
        ['u3', 1000],
      ]),
    );
    expect(summarizeFinancialReport(groups)).toEqual({
      grossIncome: 12000,
      totalExpenses: 100,
      vacancyLost: 1500,
      netIncome: 11900,
    });
  });

  it('returns zeros for no groups', () => {
    expect(summarizeFinancialReport([])).toEqual({
      grossIncome: 0,
      totalExpenses: 0,
      vacancyLost: 0,
      netIncome: 0,
    });
  });

  it('reports a negative net income when expenses exceed income', () => {
    const groups = buildPropertyGroups(
      rows.slice(0, 1),
      new Map([['u1', 1000]]),
      new Map([['u1', 4000]]),
      new Map(),
      new Map(),
    );
    expect(summarizeFinancialReport(groups).netIncome).toBe(-3000);
  });
});
