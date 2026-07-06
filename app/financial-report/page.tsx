import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { formatCents } from '@/lib/money';
import { PaymentsTabs } from '@/components/payments-tabs';
import { FinancialPeriodPicker } from '@/components/financial-period-picker';

type SearchParams = Promise<{ mode?: string; month?: string; year?: string }>;

interface UnitRow {
  propertyId: string;
  propertyName: string;
  unitId: string;
  unitLabel: string;
}

interface PropertyGroup {
  propertyId: string;
  propertyName: string;
  units: { unitId: string; unitLabel: string; income: number; expenses: number }[];
  propertyExpenses: number;
  totalIncome: number;
  totalExpenses: number;
  netIncome: number;
}

export default async function FinancialReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');
  if (session.user.role !== 'admin') notFound();

  const { mode: rawMode, month: rawMonth, year: rawYear } = await searchParams;
  const mode: 'month' | 'year' = rawMode === 'year' ? 'year' : 'month';
  const month =
    rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : new Date().toISOString().slice(0, 7);
  const year = rawYear && /^\d{4}$/.test(rawYear) ? rawYear : new Date().getFullYear().toString();

  const rows = await query<UnitRow>(
    `SELECT p.id as "propertyId", p.name as "propertyName",
            u.id as "unitId", u.unit_label as "unitLabel"
     FROM properties p
     JOIN units u ON u.property_id = p.id
     WHERE p.user_id = $1 AND p.archived_at IS NULL AND u.archived_at IS NULL
     ORDER BY p.name, u.unit_label`,
    [session.user.id],
  );

  const unitIds = rows.map((r) => r.unitId);
  const propertyIds = [...new Set(rows.map((r) => r.propertyId))];

  const incomeByUnit = new Map<string, number>();
  const expensesByUnit = new Map<string, number>();
  const expensesByProperty = new Map<string, number>();

  if (unitIds.length > 0) {
    const periodValue = mode === 'month' ? month : year;
    const periodPredicate = mode === 'month' ? 'period = $2' : 'substr(period, 1, 4) = $2';
    const expenseDatePredicate =
      mode === 'month' ? 'substr(expense_date, 1, 7) = $2' : 'substr(expense_date, 1, 4) = $2';

    const incomeTotals = await query<{ unit_id: string; total: number }>(
      `SELECT unit_id, SUM(amount)::int as total FROM rent_payments
       WHERE unit_id = ANY($1) AND ${periodPredicate}
       GROUP BY unit_id`,
      [unitIds, periodValue],
    );
    for (const t of incomeTotals) incomeByUnit.set(t.unit_id, t.total);

    const unitExpenseTotals = await query<{ unit_id: string; total: number }>(
      `SELECT unit_id, SUM(amount)::int as total FROM expenses
       WHERE unit_id = ANY($1) AND ${expenseDatePredicate}
       GROUP BY unit_id`,
      [unitIds, periodValue],
    );
    for (const t of unitExpenseTotals) expensesByUnit.set(t.unit_id, t.total);

    const propertyExpenseTotals = await query<{ property_id: string; total: number }>(
      `SELECT property_id, SUM(amount)::int as total FROM expenses
       WHERE property_id = ANY($1) AND unit_id IS NULL AND ${expenseDatePredicate}
       GROUP BY property_id`,
      [propertyIds, periodValue],
    );
    for (const t of propertyExpenseTotals) expensesByProperty.set(t.property_id, t.total);
  }

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
    const income = incomeByUnit.get(r.unitId) ?? 0;
    const expenses = expensesByUnit.get(r.unitId) ?? 0;
    group.units.push({ unitId: r.unitId, unitLabel: r.unitLabel, income, expenses });
  }

  for (const group of groups.values()) {
    const unitIncome = group.units.reduce((sum, u) => sum + u.income, 0);
    const unitExpenses = group.units.reduce((sum, u) => sum + u.expenses, 0);
    group.totalIncome = unitIncome;
    group.totalExpenses = unitExpenses + group.propertyExpenses;
    group.netIncome = group.totalIncome - group.totalExpenses;
  }

  const propertyGroups = [...groups.values()];

  return (
    <div className='p-8 max-w-5xl mx-auto'>
      <Link href='/dashboard' className='text-blue-600 hover:underline mb-4 inline-block'>
        &larr; Back to Properties
      </Link>

      <PaymentsTabs active='financial-report' isAdmin />

      <div className='flex items-center justify-between mb-6'>
        <h1 className='text-2xl font-bold'>Financial Report</h1>
        <FinancialPeriodPicker mode={mode} month={month} year={year} />
      </div>

      {propertyGroups.length === 0 ? (
        <p className='text-foreground/60'>No properties yet.</p>
      ) : (
        <div className='flex flex-col gap-8'>
          {propertyGroups.map((group) => (
            <div key={group.propertyId}>
              <h2 className='text-lg font-semibold mb-3'>{group.propertyName}</h2>
              <table className='w-full text-sm border-collapse'>
                <thead>
                  <tr className='text-left border-b border-border'>
                    <th className='py-2 pr-4'>Unit</th>
                    <th className='py-2 pr-4'>Income</th>
                    <th className='py-2 pr-4'>Expenses</th>
                  </tr>
                </thead>
                <tbody>
                  {group.units.map((u) => (
                    <tr key={u.unitId} className='border-b border-border/50'>
                      <td className='py-2 pr-4'>{u.unitLabel}</td>
                      <td className='py-2 pr-4'>{formatCents(u.income)}</td>
                      <td className='py-2 pr-4'>{formatCents(u.expenses)}</td>
                    </tr>
                  ))}
                  <tr className='border-b border-border/50'>
                    <td className='py-2 pr-4 text-foreground/60'>Property-level expenses</td>
                    <td className='py-2 pr-4'></td>
                    <td className='py-2 pr-4'>{formatCents(group.propertyExpenses)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className='font-semibold'>
                    <td className='py-2 pr-4'>Total</td>
                    <td className='py-2 pr-4'>{formatCents(group.totalIncome)}</td>
                    <td className='py-2 pr-4'>{formatCents(group.totalExpenses)}</td>
                  </tr>
                  <tr className='font-semibold'>
                    <td className='py-2 pr-4'>Net Income</td>
                    <td className='py-2 pr-4' colSpan={2}>
                      {formatCents(group.netIncome)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
