'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { query, queryOne } from '@/lib/db';
import {
  updateUnitSchema,
  assignTenantSchema,
  updateTenantSchema,
  endTenancySchema,
  recordPaymentSchema,
  updatePaymentSchema,
  recordUnitExpenseSchema,
  updateUnitExpenseSchema,
} from '@/lib/validation';

export interface UnitActionResult {
  error?: {
    unitLabel?: string[];
    bedrooms?: string[];
    bathrooms?: string[];
    rentAmount?: string[];
    general?: string;
  };
}

async function findAuthorizedUnit(unitId: string, userId: string) {
  return queryOne<{ id: string; property_id: string }>(
    `SELECT u.id, u.property_id FROM units u
     JOIN properties p ON p.id = u.property_id
     WHERE u.id = $1 AND p.user_id = $2`,
    [unitId, userId],
  );
}

export async function updateUnit(
  _prevState: UnitActionResult,
  formData: FormData,
): Promise<UnitActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = updateUnitSchema.safeParse({
    id: formData.get('id'),
    unitLabel: formData.get('unitLabel'),
    bedrooms: formData.get('bedrooms'),
    bathrooms: formData.get('bathrooms'),
    rentAmount: formData.get('rentAmount'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const unit = await findAuthorizedUnit(parsed.data.id, session.user.id);
  if (!unit) {
    return { error: { general: 'Unit not found or access denied.' } };
  }

  await query(
    'UPDATE units SET unit_label = $1, bedrooms = $2, bathrooms = $3, rent_amount = $4 WHERE id = $5',
    [
      parsed.data.unitLabel,
      parsed.data.bedrooms,
      parsed.data.bathrooms,
      parsed.data.rentAmount,
      unit.id,
    ],
  );

  redirect(`/properties/${unit.property_id}/units/${unit.id}`);
}

export async function archiveUnit(formData: FormData): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');
  if (session.user.role !== 'admin') redirect('/dashboard');

  const id = formData.get('id');
  if (typeof id !== 'string') return;

  const unit = await findAuthorizedUnit(id, session.user.id);
  if (!unit) return;

  await query('UPDATE units SET archived_at = now() WHERE id = $1', [unit.id]);
  redirect(`/properties/${unit.property_id}`);
}

export interface DeleteUnitResult {
  error?: string;
}

export async function deleteUnit(
  _prevState: DeleteUnitResult,
  formData: FormData,
): Promise<DeleteUnitResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const id = formData.get('id');
  if (typeof id !== 'string') {
    return { error: 'Invalid unit id.' };
  }

  const unit = await findAuthorizedUnit(id, session.user.id);
  if (!unit) {
    return { error: 'Unit not found or access denied.' };
  }

  const tenantCount = await queryOne<{ count: number }>(
    'SELECT COUNT(*)::int as count FROM tenants WHERE unit_id = $1',
    [unit.id],
  );
  if (tenantCount && tenantCount.count > 0) {
    return { error: 'This unit has tenant history — archive it instead of deleting.' };
  }

  await query('DELETE FROM units WHERE id = $1', [unit.id]);
  redirect(`/properties/${unit.property_id}`);
}

export interface TenantActionResult {
  error?: {
    name?: string[];
    email?: string[];
    phone?: string[];
    rentAmount?: string[];
    leaseStartDate?: string[];
    leaseEndDate?: string[];
    general?: string;
  };
}

export async function assignTenant(
  _prevState: TenantActionResult,
  formData: FormData,
): Promise<TenantActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = assignTenantSchema.safeParse({
    unitId: formData.get('unitId'),
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    rentAmount: formData.get('rentAmount'),
    leaseStartDate: formData.get('leaseStartDate'),
    leaseEndDate: formData.get('leaseEndDate'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const unit = await findAuthorizedUnit(parsed.data.unitId, session.user.id);
  if (!unit) {
    return { error: { general: 'Unit not found or access denied.' } };
  }

  const id = crypto.randomUUID();
  try {
    await query(
      `INSERT INTO tenants (id, unit_id, name, email, phone, rent_amount, lease_start_date, lease_end_date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        id,
        unit.id,
        parsed.data.name,
        parsed.data.email || null,
        parsed.data.phone || null,
        parsed.data.rentAmount,
        parsed.data.leaseStartDate,
        parsed.data.leaseEndDate || null,
      ],
    );
  } catch (err) {
    const isUniqueViolation =
      err instanceof Error && 'code' in err && (err as { code?: string }).code === '23505';
    if (isUniqueViolation) {
      return { error: { general: 'This unit already has an active tenant.' } };
    }
    return { error: { general: 'Failed to assign tenant. Please try again.' } };
  }

  redirect(`/properties/${unit.property_id}/units/${unit.id}`);
}

async function findAuthorizedTenant(tenantId: string, userId: string) {
  return queryOne<{ id: string; unit_id: string; property_id: string; is_active: boolean }>(
    `SELECT t.id, t.unit_id, u.property_id, t.is_active FROM tenants t
     JOIN units u ON u.id = t.unit_id
     JOIN properties p ON p.id = u.property_id
     WHERE t.id = $1 AND p.user_id = $2`,
    [tenantId, userId],
  );
}

export async function updateTenant(
  _prevState: TenantActionResult,
  formData: FormData,
): Promise<TenantActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = updateTenantSchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    email: formData.get('email'),
    phone: formData.get('phone'),
    rentAmount: formData.get('rentAmount'),
    leaseStartDate: formData.get('leaseStartDate'),
    leaseEndDate: formData.get('leaseEndDate'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const tenant = await findAuthorizedTenant(parsed.data.id, session.user.id);
  if (!tenant) {
    return { error: { general: 'Tenant not found or access denied.' } };
  }

  await query(
    `UPDATE tenants SET name = $1, email = $2, phone = $3, rent_amount = $4, lease_start_date = $5, lease_end_date = $6
     WHERE id = $7`,
    [
      parsed.data.name,
      parsed.data.email || null,
      parsed.data.phone || null,
      parsed.data.rentAmount,
      parsed.data.leaseStartDate,
      parsed.data.leaseEndDate || null,
      tenant.id,
    ],
  );

  redirect(`/properties/${tenant.property_id}/units/${tenant.unit_id}`);
}

export async function endTenancy(formData: FormData): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = endTenancySchema.safeParse({
    id: formData.get('id'),
    leaseEndDate: formData.get('leaseEndDate'),
  });
  if (!parsed.success) return;

  const tenant = await findAuthorizedTenant(parsed.data.id, session.user.id);
  if (!tenant) return;

  await query('UPDATE tenants SET is_active = false, lease_end_date = $1 WHERE id = $2', [
    parsed.data.leaseEndDate,
    tenant.id,
  ]);

  redirect(`/properties/${tenant.property_id}/units/${tenant.unit_id}`);
}

export interface PaymentActionResult {
  error?: {
    amount?: string[];
    period?: string[];
    paidDate?: string[];
    paymentType?: string[];
    method?: string[];
    notes?: string[];
    general?: string;
  };
}

export async function recordPayment(
  _prevState: PaymentActionResult,
  formData: FormData,
): Promise<PaymentActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = recordPaymentSchema.safeParse({
    tenantId: formData.get('tenantId'),
    amount: formData.get('amount'),
    period: formData.get('period'),
    paidDate: formData.get('paidDate'),
    paymentType: formData.get('paymentType'),
    method: formData.get('method'),
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const tenant = await findAuthorizedTenant(parsed.data.tenantId, session.user.id);
  if (!tenant) {
    return { error: { general: 'Tenant not found or access denied.' } };
  }
  if (!tenant.is_active) {
    return { error: { general: 'Cannot record a payment for an ended tenancy.' } };
  }

  const id = crypto.randomUUID();
  await query(
    `INSERT INTO rent_payments (id, tenant_id, unit_id, amount, period, paid_date, payment_type, method, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      id,
      tenant.id,
      tenant.unit_id,
      parsed.data.amount,
      parsed.data.period,
      parsed.data.paidDate,
      parsed.data.paymentType,
      parsed.data.method || null,
      parsed.data.notes || null,
    ],
  );

  redirect(`/properties/${tenant.property_id}/units/${tenant.unit_id}`);
}

async function findAuthorizedPayment(paymentId: string, userId: string) {
  return queryOne<{
    id: string;
    tenant_id: string;
    unit_id: string;
    property_id: string;
    tenant_is_active: boolean;
  }>(
    `SELECT rp.id, rp.tenant_id, rp.unit_id, u.property_id, t.is_active as tenant_is_active
     FROM rent_payments rp
     JOIN tenants t ON t.id = rp.tenant_id
     JOIN units u ON u.id = t.unit_id
     JOIN properties p ON p.id = u.property_id
     WHERE rp.id = $1 AND p.user_id = $2`,
    [paymentId, userId],
  );
}

export async function updatePayment(
  _prevState: PaymentActionResult,
  formData: FormData,
): Promise<PaymentActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = updatePaymentSchema.safeParse({
    id: formData.get('id'),
    amount: formData.get('amount'),
    period: formData.get('period'),
    paidDate: formData.get('paidDate'),
    paymentType: formData.get('paymentType'),
    method: formData.get('method'),
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const payment = await findAuthorizedPayment(parsed.data.id, session.user.id);
  if (!payment) {
    return { error: { general: 'Payment not found or access denied.' } };
  }
  if (!payment.tenant_is_active) {
    return { error: { general: 'Cannot edit a payment from an ended tenancy.' } };
  }

  await query(
    'UPDATE rent_payments SET amount = $1, period = $2, paid_date = $3, payment_type = $4, method = $5, notes = $6 WHERE id = $7',
    [
      parsed.data.amount,
      parsed.data.period,
      parsed.data.paidDate,
      parsed.data.paymentType,
      parsed.data.method || null,
      parsed.data.notes || null,
      payment.id,
    ],
  );

  redirect(`/properties/${payment.property_id}/units/${payment.unit_id}`);
}

export async function deletePayment(formData: FormData): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const id = formData.get('id');
  if (typeof id !== 'string') return;

  const payment = await findAuthorizedPayment(id, session.user.id);
  if (!payment) return;
  if (!payment.tenant_is_active) return;

  await query('DELETE FROM rent_payments WHERE id = $1', [payment.id]);
  redirect(`/properties/${payment.property_id}/units/${payment.unit_id}`);
}

export interface ExpenseActionResult {
  error?: {
    category?: string[];
    amount?: string[];
    expenseDate?: string[];
    remarks?: string[];
    general?: string;
  };
}

async function findAuthorizedExpense(expenseId: string, userId: string) {
  return queryOne<{ id: string; unit_id: string; property_id: string }>(
    `SELECT e.id, e.unit_id, e.property_id FROM expenses e
     JOIN units u ON u.id = e.unit_id
     JOIN properties p ON p.id = u.property_id
     WHERE e.id = $1 AND p.user_id = $2`,
    [expenseId, userId],
  );
}

export async function recordUnitExpense(
  _prevState: ExpenseActionResult,
  formData: FormData,
): Promise<ExpenseActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = recordUnitExpenseSchema.safeParse({
    unitId: formData.get('unitId'),
    category: formData.get('category'),
    amount: formData.get('amount'),
    expenseDate: formData.get('expenseDate'),
    remarks: formData.get('remarks') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const unit = await findAuthorizedUnit(parsed.data.unitId, session.user.id);
  if (!unit) {
    return { error: { general: 'Unit not found or access denied.' } };
  }

  const id = crypto.randomUUID();
  await query(
    `INSERT INTO expenses (id, property_id, unit_id, category, amount, expense_date, remarks)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      id,
      unit.property_id,
      unit.id,
      parsed.data.category,
      parsed.data.amount,
      parsed.data.expenseDate,
      parsed.data.remarks || null,
    ],
  );

  redirect(`/properties/${unit.property_id}/units/${unit.id}`);
}

export async function updateUnitExpense(
  _prevState: ExpenseActionResult,
  formData: FormData,
): Promise<ExpenseActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = updateUnitExpenseSchema.safeParse({
    id: formData.get('id'),
    category: formData.get('category'),
    amount: formData.get('amount'),
    expenseDate: formData.get('expenseDate'),
    remarks: formData.get('remarks') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const expense = await findAuthorizedExpense(parsed.data.id, session.user.id);
  if (!expense) {
    return { error: { general: 'Expense not found or access denied.' } };
  }

  await query(
    'UPDATE expenses SET category = $1, amount = $2, expense_date = $3, remarks = $4 WHERE id = $5',
    [
      parsed.data.category,
      parsed.data.amount,
      parsed.data.expenseDate,
      parsed.data.remarks || null,
      expense.id,
    ],
  );

  redirect(`/properties/${expense.property_id}/units/${expense.unit_id}`);
}

export async function deleteUnitExpense(formData: FormData): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const id = formData.get('id');
  if (typeof id !== 'string') return;

  const expense = await findAuthorizedExpense(id, session.user.id);
  if (!expense) return;

  await query('DELETE FROM expenses WHERE id = $1', [expense.id]);
  redirect(`/properties/${expense.property_id}/units/${expense.unit_id}`);
}
