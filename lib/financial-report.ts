export interface UnitRow {
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitLabel: string;
}

export interface PropertyGroup {
  propertyId: string;
  propertyName: string;
  units: { unitId: string; unitLabel: string; income: number; expenses: number }[];
  propertyExpenses: number;
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
}

export interface FinancialReportTotals {
  grossIncome: number;
  totalExpenses: number;
  netIncome: number;
}

// Fold the flat unit rows plus per-unit/per-property lookups into one group per
// property, carrying each unit's income/expenses and the derived totals the
// report renders.
export function buildPropertyGroups(
  rows: UnitRow[],
  incomeByUnit: Map<string, number>,
  expensesByUnit: Map<string, number>,
  expensesByProperty: Map<string, number>,
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
        netIncome: 0,
      });
    }
    const group = groups.get(r.propertyId)!;
    group.units.push({
      unitId: r.unitId,
      unitLabel: r.unitLabel,
      income: incomeByUnit.get(r.unitId) ?? 0,
      expenses: expensesByUnit.get(r.unitId) ?? 0,
    });
  }

  for (const group of groups.values()) {
    const unitIncome = group.units.reduce((sum, u) => sum + u.income, 0);
    const unitExpenses = group.units.reduce((sum, u) => sum + u.expenses, 0);
    group.totalIncome = unitIncome;
    group.totalExpenses = unitExpenses + group.propertyExpenses;
    group.netIncome = group.totalIncome - group.totalExpenses;
  }

  return [...groups.values()];
}

// Portfolio-wide totals for the at-a-glance summary cards: sum each property's
// gross income and expenses, with net income derived so it always reconciles.
export function summarizeFinancialReport(groups: PropertyGroup[]): FinancialReportTotals {
  let grossIncome = 0;
  let totalExpenses = 0;
  for (const g of groups) {
    grossIncome += g.totalIncome;
    totalExpenses += g.totalExpenses;
  }
  return { grossIncome, totalExpenses, netIncome: grossIncome - totalExpenses };
}
