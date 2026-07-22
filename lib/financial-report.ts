import { format } from 'date-fns';
import { isLeaseActiveForPeriod } from '@/lib/payment-status';

export interface UnitRow {
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitLabel: string;
  rentAmount: number;
  createdPeriod: string;
}

export interface LeaseRow {
  unitId: string;
  leaseStartDate: string;
  leaseEndDate: string | null;
}

export interface PropertyGroup {
  propertyId: string;
  propertyName: string;
  units: {
    unitId: string;
    unitLabel: string;
    income: number;
    expenses: number;
    vacancyLost: number;
  }[];
  propertyExpenses: number;
  totalIncome: number;
  totalExpenses: number;
  totalVacancyLost: number;
  netIncome: number;
}

export interface FinancialReportTotals {
  grossIncome: number;
  totalExpenses: number;
  vacancyLost: number;
  netIncome: number;
}

export function reportPeriods(
  mode: 'month' | 'year',
  month: string,
  year: string,
  throughPeriod = format(new Date(), 'yyyy-MM'),
): string[] {
  const periods =
    mode === 'month'
      ? [month]
      : Array.from({ length: 12 }, (_, index) => `${year}-${String(index + 1).padStart(2, '0')}`);
  return periods.filter((period) => period <= throughPeriod);
}

// Vacancy loss is the unit's asking monthly rent for each reporting month in
// which the unit existed but no tenant lease covered that month.
export function calculateVacancyLostByUnit(
  rows: UnitRow[],
  leases: LeaseRow[],
  periods: string[],
): Map<string, number> {
  const leasesByUnit = new Map<string, LeaseRow[]>();
  for (const lease of leases) {
    const unitLeases = leasesByUnit.get(lease.unitId);
    if (unitLeases) unitLeases.push(lease);
    else leasesByUnit.set(lease.unitId, [lease]);
  }

  const vacancyLostByUnit = new Map<string, number>();
  for (const row of rows) {
    const unitLeases = leasesByUnit.get(row.unitId) ?? [];
    const vacantMonths = periods.filter(
      (period) =>
        period >= row.createdPeriod &&
        !unitLeases.some((lease) =>
          isLeaseActiveForPeriod(lease.leaseStartDate, lease.leaseEndDate, period),
        ),
    ).length;
    vacancyLostByUnit.set(row.unitId, vacantMonths * row.rentAmount);
  }
  return vacancyLostByUnit;
}

// Fold the flat unit rows plus per-unit/per-property lookups into one group per
// property, carrying each unit's income/expenses and the derived totals the
// report renders.
export function buildPropertyGroups(
  rows: UnitRow[],
  incomeByUnit: Map<string, number>,
  expensesByUnit: Map<string, number>,
  expensesByProperty: Map<string, number>,
  vacancyLostByUnit: Map<string, number>,
): PropertyGroup[] {
  const groups = new Map<string, PropertyGroup>();
  for (const r of rows) {
    if (!groups.has(r.propertyId)) {
      groups.set(r.propertyId, {
        propertyId: r.propertyId,
        propertyName: r.propertyName,
        units: [],
        propertyExpenses: expensesByProperty.get(r.propertyId) ?? 0,
        totalIncome: 0,
        totalExpenses: 0,
        totalVacancyLost: 0,
        netIncome: 0,
      });
    }
    const group = groups.get(r.propertyId)!;
    group.units.push({
      unitId: r.unitId,
      unitLabel: r.unitLabel,
      income: incomeByUnit.get(r.unitId) ?? 0,
      expenses: expensesByUnit.get(r.unitId) ?? 0,
      vacancyLost: vacancyLostByUnit.get(r.unitId) ?? 0,
    });
  }

  for (const group of groups.values()) {
    const unitIncome = group.units.reduce((sum, u) => sum + u.income, 0);
    const unitExpenses = group.units.reduce((sum, u) => sum + u.expenses, 0);
    group.totalIncome = unitIncome;
    group.totalExpenses = unitExpenses + group.propertyExpenses;
    group.totalVacancyLost = group.units.reduce((sum, u) => sum + u.vacancyLost, 0);
    group.netIncome = group.totalIncome - group.totalExpenses;
  }

  return [...groups.values()];
}

// Portfolio-wide totals for the at-a-glance summary cards: sum each property's
// gross income and expenses, with net income derived so it always reconciles.
export function summarizeFinancialReport(groups: PropertyGroup[]): FinancialReportTotals {
  let grossIncome = 0;
  let totalExpenses = 0;
  let vacancyLost = 0;
  for (const g of groups) {
    grossIncome += g.totalIncome;
    totalExpenses += g.totalExpenses;
    vacancyLost += g.totalVacancyLost;
  }
  return { grossIncome, totalExpenses, vacancyLost, netIncome: grossIncome - totalExpenses };
}
