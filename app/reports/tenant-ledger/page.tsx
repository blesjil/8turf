import { notFound, redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { format } from 'date-fns';
import { auth } from '@/lib/auth';
import { ownerScope } from '@/lib/access';
import { formatCents } from '@/lib/money';
import { formatDate } from '@/lib/format-date';
import { deriveCharges, type PaymentInput } from '@/lib/reports/charges';
import { fetchLeases } from '@/lib/reports/data';
import { periodsInRange } from '@/lib/reports/period';
import { buildLedger, fetchLedgerPayments } from '@/lib/reports/tenant-ledger';
import { PageContainer } from '@/components/page-container';
import { ReportsNav } from '@/components/reports/reports-nav';
import { ReportHeader } from '@/components/reports/report-header';
import { TenantPicker, type TenantOption } from '@/components/reports/tenant-picker';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

type SearchParams = Promise<{ tenant?: string }>;

export default async function TenantLedgerReportPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');
  if (session.user.role !== 'admin') notFound();

  const scope = ownerScope(session);
  const { tenant: tenantId } = await searchParams;
  const today = format(new Date(), 'yyyy-MM-dd');

  const leases = await fetchLeases(scope);
  const tenants: TenantOption[] = leases.map((l) => ({
    tenantId: l.tenantId,
    label: `${l.tenantName} — ${l.propertyName} ${l.unitLabel}`,
  }));

  const lease = tenantId ? leases.find((l) => l.tenantId === tenantId) : undefined;

  let ledger: ReturnType<typeof buildLedger> = [];
  if (lease) {
    const payments = await fetchLedgerPayments(lease.tenantId, scope);
    const paymentInputs: PaymentInput[] = payments.map((p) => ({
      tenantId: lease.tenantId,
      amount: p.amount,
      period_start: p.periodStart,
      period_end: p.periodEnd,
      payment_type: p.paymentType,
      paid_date: p.paidDate,
    }));

    const currentMonth = format(new Date(), 'yyyy-MM');
    const startMonth = lease.leaseStartDate.slice(0, 7);
    const leaseEndMonth = lease.leaseEndDate ? lease.leaseEndDate.slice(0, 7) : currentMonth;
    const endMonth = leaseEndMonth < currentMonth ? leaseEndMonth : currentMonth;
    const periods = startMonth <= endMonth ? periodsInRange(startMonth, endMonth) : [];

    // A charge accrues on its due date — the current month's charge stays off
    // the ledger until the anchor day arrives, so a pre-due payment correctly
    // shows as tenant credit rather than the tenant looking like they owe early.
    const charges = deriveCharges([lease], paymentInputs, periods, today).filter(
      (c) => c.dueDate <= today,
    );
    ledger = buildLedger(charges, payments);
  }

  const balance = ledger.length > 0 ? ledger[ledger.length - 1].runningBalance : 0;

  return (
    <PageContainer>
      <ReportsNav />
      <ReportHeader
        title='Tenant Ledger'
        dateBasis='Transaction date'
        action={<TenantPicker tenants={tenants} value={tenantId ?? null} />}
      />

      {!lease ? (
        <Card className='py-8 text-center'>
          <CardHeader className='items-center'>
            <CardTitle>Select a tenant</CardTitle>
            <CardDescription>
              Choose a tenant above to view their full charge and payment history.
            </CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className='flex flex-col gap-6'>
          <Card className='flex-row items-center justify-between px-5 py-4'>
            <div className='flex flex-col gap-0.5'>
              <span className='text-sm text-muted-foreground'>
                {lease.tenantName} · {lease.propertyName} {lease.unitLabel}
              </span>
              <span className='text-xs text-muted-foreground'>
                {balance > 0 ? 'Owes' : balance < 0 ? 'Credit' : 'Settled'}
              </span>
            </div>
            <span
              className={`font-heading text-2xl font-semibold tabular-nums ${
                balance > 0 ? 'text-destructive' : balance < 0 ? 'text-primary' : ''
              }`}
            >
              {formatCents(Math.abs(balance))}
            </span>
          </Card>

          <Card className='py-0'>
            <div className='overflow-x-auto'>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Coverage</TableHead>
                    <TableHead className='text-right'>Debit</TableHead>
                    <TableHead className='text-right'>Credit</TableHead>
                    <TableHead className='text-right'>Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {ledger.map((e, i) => (
                    <TableRow key={`${e.date}-${e.type}-${i}`}>
                      <TableCell>{formatDate(e.date)}</TableCell>
                      <TableCell className='capitalize'>{e.type}</TableCell>
                      <TableCell>{e.description}</TableCell>
                      <TableCell className='text-muted-foreground'>{e.coverage ?? '—'}</TableCell>
                      <TableCell className='text-right font-mono tabular-nums'>
                        {e.debit > 0 ? formatCents(e.debit) : '—'}
                      </TableCell>
                      <TableCell className='text-right font-mono tabular-nums'>
                        {e.credit > 0 ? formatCents(e.credit) : '—'}
                      </TableCell>
                      <TableCell
                        className={`text-right font-mono tabular-nums ${
                          e.runningBalance > 0
                            ? 'text-destructive'
                            : e.runningBalance < 0
                              ? 'text-primary'
                              : ''
                        }`}
                      >
                        {formatCents(e.runningBalance)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Card>
          <p className='text-xs text-muted-foreground'>
            Deposits and reservations are held separately and are not part of the rent balance.
          </p>
        </div>
      )}
    </PageContainer>
  );
}
