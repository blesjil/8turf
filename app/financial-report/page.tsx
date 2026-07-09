import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { endOfMonth, format, parseISO } from 'date-fns';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { query } from '@/lib/db';
import { formatCents } from '@/lib/money';
import { creditsByPeriod, RENT_COVERING_PAYMENT_TYPES } from '@/lib/payment-status';
import { PaymentsTabs } from '@/components/payments-tabs';
import { FinancialPeriodPicker } from '@/components/financial-period-picker';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

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
    rawMonth && /^\d{4}-\d{2}$/.test(rawMonth) ? rawMonth : format(new Date(), 'yyyy-MM');
  const year = rawYear && /^\d{4}$/.test(rawYear) ? rawYear : new Date().getFullYear().toString();

  const rows = await query<UnitRow>(
    `SELECT p.id as "propertyId", p.name as "propertyName",
            u.id as "unitId", u.unit_label as "unitLabel"
     FROM properties p
     JOIN units u ON u.property_id = p.id
     WHERE p.archived_at IS NULL AND u.archived_at IS NULL
     ORDER BY p.name, u.unit_label`,
  );

  const unitIds = rows.map((r) => r.unitId);
  const propertyIds = [...new Set(rows.map((r) => r.propertyId))];

  const incomeByUnit = new Map<string, number>();
  const expensesByUnit = new Map<string, number>();
  const expensesByProperty = new Map<string, number>();

  if (unitIds.length > 0) {
    const periodValue = mode === 'month' ? month : year;
    const expenseDatePredicate =
      mode === 'month' ? 'substr(expense_date, 1, 7) = $2' : 'substr(expense_date, 1, 4) = $2';

    // Multi-month payments credit each covered month a share of the amount, so
    // fetch every range overlapping the reporting window and keep the shares
    // whose month falls inside it.
    const windowStart = mode === 'month' ? `${month}-01` : `${year}-01-01`;
    const windowEnd =
      mode === 'month' ? format(endOfMonth(parseISO(windowStart)), 'yyyy-MM-dd') : `${year}-12-31`;
    const payments = await query<{
      unit_id: string;
      amount: number;
      period_start: string;
      period_end: string;
    }>(
      `SELECT unit_id, amount, period_start, period_end FROM rent_payments
       WHERE unit_id = ANY($1) AND period_start <= $2 AND period_end >= $3
         AND payment_type = ANY($4)`,
      [unitIds, windowEnd, windowStart, RENT_COVERING_PAYMENT_TYPES],
    );
    for (const p of payments) {
      for (const [creditPeriod, credit] of creditsByPeriod(p)) {
        const inWindow = mode === 'month' ? creditPeriod === month : creditPeriod.startsWith(year);
        if (inWindow) incomeByUnit.set(p.unit_id, (incomeByUnit.get(p.unit_id) ?? 0) + credit);
      }
    }

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
    <div className='mx-auto max-w-6xl p-4 sm:p-8'>
      <PaymentsTabs active='financial-report' isAdmin />

      <div className='mb-6 flex flex-wrap items-center justify-between gap-3'>
        <h1 className='text-2xl font-semibold tracking-tight'>Financial Report</h1>
        <FinancialPeriodPicker mode={mode} month={month} year={year} />
      </div>

      {propertyGroups.length === 0 ? (
        <Card className='py-8 text-center'>
          <CardHeader className='items-center'>
            <CardTitle>No properties yet</CardTitle>
            <CardDescription>Add a property to see its income and expenses here.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className='flex flex-col gap-8'>
          {propertyGroups.map((group) => (
            <div key={group.propertyId}>
              <div className='mb-3 flex flex-wrap items-baseline justify-between gap-2'>
                <h2 className='text-lg font-semibold tracking-tight'>{group.propertyName}</h2>
                <p className='text-sm text-muted-foreground'>
                  Net income:{' '}
                  <span
                    className={cn(
                      'font-mono font-semibold tabular-nums',
                      group.netIncome >= 0 ? 'text-success' : 'text-destructive',
                    )}
                  >
                    {formatCents(group.netIncome)}
                  </span>
                </p>
              </div>
              <Card className='py-0'>
                <div className='overflow-x-auto'>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Unit</TableHead>
                        <TableHead className='text-right'>Income</TableHead>
                        <TableHead className='text-right'>Expenses</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {group.units.map((u) => (
                        <TableRow key={u.unitId}>
                          <TableCell>
                            <Link
                              href={`/properties/${group.propertyId}/units/${u.unitId}`}
                              className='font-mono font-medium text-primary hover:underline'
                            >
                              {u.unitLabel}
                            </Link>
                          </TableCell>
                          <TableCell className='text-right font-mono tabular-nums'>
                            {formatCents(u.income)}
                          </TableCell>
                          <TableCell className='text-right font-mono tabular-nums'>
                            {formatCents(u.expenses)}
                          </TableCell>
                        </TableRow>
                      ))}
                      <TableRow>
                        <TableCell className='text-muted-foreground'>
                          Property-level expenses
                        </TableCell>
                        <TableCell />
                        <TableCell className='text-right font-mono tabular-nums'>
                          {formatCents(group.propertyExpenses)}
                        </TableCell>
                      </TableRow>
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell>Total</TableCell>
                        <TableCell className='text-right font-mono tabular-nums'>
                          {formatCents(group.totalIncome)}
                        </TableCell>
                        <TableCell className='text-right font-mono tabular-nums'>
                          {formatCents(group.totalExpenses)}
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </Card>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
