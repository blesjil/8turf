import { redirect, notFound } from 'next/navigation';
import { headers } from 'next/headers';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import { formatCents } from '@/lib/money';
import { formatDate, formatPeriod } from '@/lib/format-date';
import { UnitActions } from './unit-actions';
import { TenantCard, type Tenant } from '@/components/tenant-card';
import { PaymentLedger, type Payment } from '@/components/payment-ledger';
import { PaymentStatusBadge } from '@/components/payment-status-badge';
import { computePaymentStatus, isLeaseActiveForPeriod } from '@/lib/payment-status';
import { ExpenseList, type Expense } from '@/components/expense-list';
import { recordUnitExpense, updateUnitExpense, deleteUnitExpense } from './actions';

type Params = Promise<{ id: string; unitId: string }>;

interface Unit {
  id: string;
  property_id: string;
  unit_label: string;
  bedrooms: number;
  bathrooms: number;
  rent_amount: number;
}

export default async function UnitDetail({ params }: { params: Params }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const { id, unitId } = await params;

  const unit = await queryOne<Unit>(
    `SELECT u.id, u.property_id, u.unit_label, u.bedrooms, u.bathrooms, u.rent_amount
     FROM units u
     JOIN properties p ON p.id = u.property_id
     WHERE u.id = $1 AND u.property_id = $2 AND p.user_id = $3`,
    [unitId, id, session.user.id],
  );
  if (!unit) notFound();

  const activeTenant = await queryOne<Tenant>(
    `SELECT id, name, email, phone, rent_amount, lease_start_date, lease_end_date, is_active
     FROM tenants WHERE unit_id = $1 AND is_active`,
    [unit.id],
  );

  const tenantHistory = await query<Tenant>(
    `SELECT id, name, email, phone, rent_amount, lease_start_date, lease_end_date, is_active
     FROM tenants WHERE unit_id = $1 ORDER BY lease_start_date DESC`,
    [unit.id],
  );

  const pastTenants = tenantHistory.filter((t) => !t.is_active);

  const expenses = await query<Expense>(
    `SELECT id, category, amount, expense_date, remarks FROM expenses
     WHERE unit_id = $1 ORDER BY expense_date DESC`,
    [unit.id],
  );

  const currentPeriod = new Date().toISOString().slice(0, 7);

  const paymentsByTenant = new Map<string, Payment[]>();
  for (const t of tenantHistory) {
    const tenantPayments = await query<Payment>(
      `SELECT id, amount, period, paid_date, payment_type, method, notes FROM rent_payments
       WHERE tenant_id = $1 ORDER BY period DESC, paid_date DESC`,
      [t.id],
    );
    paymentsByTenant.set(t.id, tenantPayments);
  }

  const currentPeriodTotal = ((activeTenant && paymentsByTenant.get(activeTenant.id)) || [])
    .filter((p) => p.period === currentPeriod)
    .reduce((sum, p) => sum + p.amount, 0);

  const currentStatus =
    activeTenant &&
    isLeaseActiveForPeriod(
      activeTenant.lease_start_date,
      activeTenant.lease_end_date,
      currentPeriod,
    )
      ? computePaymentStatus(currentPeriodTotal, activeTenant.rent_amount)
      : null;

  return (
    <div className='mx-auto max-w-4xl p-4 sm:p-8'>
      <Link
        href={`/properties/${unit.property_id}`}
        className='mb-4 inline-block text-sm font-medium text-primary hover:underline'
      >
        &larr; Back to Property
      </Link>

      <div className='mb-8 flex flex-wrap items-start justify-between gap-3'>
        <div>
          <h1 className='font-mono text-3xl font-semibold tracking-tight'>{unit.unit_label}</h1>
          <p className='text-muted-foreground'>
            {unit.bedrooms} bd / {unit.bathrooms} ba ·{' '}
            <span className='font-mono'>{formatCents(unit.rent_amount)}</span>/mo asking
          </p>
        </div>
        <UnitActions
          propertyId={unit.property_id}
          unitId={unit.id}
          isAdmin={session.user.role === 'admin'}
        />
      </div>

      <div className='mb-10'>
        <h2 className='mb-4 text-xl font-semibold tracking-tight'>Current Tenant</h2>
        <TenantCard unitId={unit.id} tenant={activeTenant} />
      </div>

      {activeTenant && (
        <div className='mb-10'>
          <div className='mb-4 flex flex-wrap items-center justify-between gap-2'>
            <h2 className='text-xl font-semibold tracking-tight'>Payment Ledger</h2>
            {currentStatus && (
              <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                <span>This month ({formatPeriod(currentPeriod)}):</span>
                <PaymentStatusBadge status={currentStatus} />
              </div>
            )}
          </div>
          <PaymentLedger
            tenantId={activeTenant.id}
            payments={paymentsByTenant.get(activeTenant.id) ?? []}
          />
        </div>
      )}

      {pastTenants.length > 0 && (
        <div className='mb-10'>
          <h2 className='mb-4 text-xl font-semibold tracking-tight'>Tenancy History</h2>
          <ul className='space-y-6'>
            {pastTenants.map((t) => (
              <li key={t.id}>
                <p className='mb-3 border-b border-border pb-2 text-sm text-muted-foreground'>
                  <strong className='text-foreground'>{t.name}</strong> ·{' '}
                  {formatDate(t.lease_start_date)} to{' '}
                  {t.lease_end_date ? formatDate(t.lease_end_date) : 'ongoing'}
                </p>
                <PaymentLedger
                  tenantId={t.id}
                  payments={paymentsByTenant.get(t.id) ?? []}
                  readOnly
                />
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        <h2 className='mb-4 text-xl font-semibold tracking-tight'>Unit Expenses</h2>
        <ExpenseList
          parentIdField='unitId'
          parentId={unit.id}
          expenses={expenses}
          recordAction={recordUnitExpense}
          updateAction={updateUnitExpense}
          deleteAction={deleteUnitExpense}
        />
      </div>
    </div>
  );
}
