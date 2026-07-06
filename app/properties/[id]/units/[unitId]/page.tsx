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
    <div className='p-8 max-w-3xl mx-auto'>
      <Link
        href={`/properties/${unit.property_id}`}
        className='text-blue-600 hover:underline mb-4 inline-block'
      >
        &larr; Back to Property
      </Link>

      <div className='flex items-start justify-between mb-6'>
        <div>
          <h1 className='text-3xl font-bold'>{unit.unit_label}</h1>
          <p className='text-foreground/60'>
            {unit.bedrooms} bd / {unit.bathrooms} ba &middot; {formatCents(unit.rent_amount)}/mo
            asking
          </p>
        </div>
        <UnitActions
          propertyId={unit.property_id}
          unitId={unit.id}
          isAdmin={session.user.role === 'admin'}
        />
      </div>

      <div className='mb-8'>
        <h2 className='text-xl font-semibold mb-3'>Current Tenant</h2>
        <TenantCard unitId={unit.id} tenant={activeTenant} />
      </div>

      {activeTenant && (
        <div className='mb-8'>
          <div className='mb-4 flex items-center gap-2'>
            <span className='text-sm text-foreground/60'>
              This month ({formatPeriod(currentPeriod)}):
            </span>
            {currentStatus && <PaymentStatusBadge status={currentStatus} />}
          </div>
          <h2 className='text-xl font-semibold mb-3'>Payment Ledger</h2>
          <PaymentLedger
            tenantId={activeTenant.id}
            payments={paymentsByTenant.get(activeTenant.id) ?? []}
          />
        </div>
      )}

      {pastTenants.length > 0 && (
        <div className='mb-8'>
          <h2 className='text-xl font-semibold mb-3'>Tenancy History</h2>
          <ul className='space-y-6'>
            {pastTenants.map((t) => (
              <li key={t.id}>
                <p className='text-sm text-foreground/60 border-b border-border/50 pb-2 mb-3'>
                  <strong className='text-foreground'>{t.name}</strong> &middot;{' '}
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

      <div className='mb-8'>
        <h2 className='text-xl font-semibold mb-3'>Unit Expenses</h2>
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
