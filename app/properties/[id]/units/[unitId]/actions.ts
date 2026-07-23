'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { ownerScope } from '@/lib/access';
import { query, queryOne } from '@/lib/db';
import { centsFromFormData } from '@/lib/money';
import { sendPaymentReceipt } from '@/lib/mail';
import { sendSmsPaymentReceipt } from '@/lib/sms';
import { findAuthorizedTenant, findAuthorizedDocument } from '@/lib/tenants';
import { isDriveConfigured, uploadFileToDrive, deleteDriveFile } from '@/lib/drive';
import {
  updateUnitSchema,
  assignTenantSchema,
  updateTenantSchema,
  endTenancySchema,
  recordPaymentSchema,
  updatePaymentSchema,
  recordUnitExpenseSchema,
  updateUnitExpenseSchema,
  validateDocumentFile,
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

async function findAuthorizedUnit(unitId: string, scope: string | null) {
  return queryOne<{ id: string; property_id: string }>(
    `SELECT u.id, u.property_id FROM units u
     JOIN properties p ON p.id = u.property_id
     WHERE u.id = $1 AND ($2::text IS NULL OR p.user_id = $2)`,
    [unitId, scope],
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
    rentAmount: centsFromFormData(formData, 'rentAmount', 'rentAmountDollars'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const unit = await findAuthorizedUnit(parsed.data.id, ownerScope(session));
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

  const unit = await findAuthorizedUnit(id, ownerScope(session));
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

  const unit = await findAuthorizedUnit(id, ownerScope(session));
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
    occupants?: string[];
    emergencyContactName?: string[];
    emergencyContactPhone?: string[];
    rentAmount?: string[];
    depositAmount?: string[];
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
    occupants: formData
      .getAll('occupants')
      .filter((v): v is string => typeof v === 'string' && v.trim() !== ''),
    emergencyContactName: formData.get('emergencyContactName'),
    emergencyContactPhone: formData.get('emergencyContactPhone'),
    rentAmount: centsFromFormData(formData, 'rentAmount', 'rentAmountDollars'),
    depositAmount: centsFromFormData(formData, 'depositAmount', 'depositAmountDollars'),
    leaseStartDate: formData.get('leaseStartDate'),
    leaseEndDate: formData.get('leaseEndDate'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const unit = await findAuthorizedUnit(parsed.data.unitId, ownerScope(session));
  if (!unit) {
    return { error: { general: 'Unit not found or access denied.' } };
  }

  const id = crypto.randomUUID();
  try {
    await query(
      `INSERT INTO tenants (id, unit_id, name, email, phone, rent_amount, deposit_amount, lease_start_date, lease_end_date, occupants, emergency_contact_name, emergency_contact_phone)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [
        id,
        unit.id,
        parsed.data.name,
        parsed.data.email || null,
        parsed.data.phone || null,
        parsed.data.rentAmount,
        parsed.data.depositAmount,
        parsed.data.leaseStartDate,
        parsed.data.leaseEndDate || null,
        JSON.stringify(parsed.data.occupants ?? []),
        parsed.data.emergencyContactName || null,
        parsed.data.emergencyContactPhone || null,
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
    occupants: formData
      .getAll('occupants')
      .filter((v): v is string => typeof v === 'string' && v.trim() !== ''),
    emergencyContactName: formData.get('emergencyContactName'),
    emergencyContactPhone: formData.get('emergencyContactPhone'),
    rentAmount: centsFromFormData(formData, 'rentAmount', 'rentAmountDollars'),
    depositAmount: centsFromFormData(formData, 'depositAmount', 'depositAmountDollars'),
    leaseStartDate: formData.get('leaseStartDate'),
    leaseEndDate: formData.get('leaseEndDate'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const tenant = await findAuthorizedTenant(parsed.data.id, ownerScope(session));
  if (!tenant) {
    return { error: { general: 'Tenant not found or access denied.' } };
  }

  await query(
    `UPDATE tenants SET name = $1, email = $2, phone = $3, rent_amount = $4, deposit_amount = $5, lease_start_date = $6, lease_end_date = $7,
       occupants = $8, emergency_contact_name = $9, emergency_contact_phone = $10
     WHERE id = $11`,
    [
      parsed.data.name,
      parsed.data.email || null,
      parsed.data.phone || null,
      parsed.data.rentAmount,
      parsed.data.depositAmount,
      parsed.data.leaseStartDate,
      parsed.data.leaseEndDate || null,
      JSON.stringify(parsed.data.occupants ?? []),
      parsed.data.emergencyContactName || null,
      parsed.data.emergencyContactPhone || null,
      tenant.id,
    ],
  );

  redirect(`/properties/${tenant.property_id}/units/${tenant.unit_id}`);
}

export interface EndTenancyResult {
  error?: string;
}

export async function endTenancy(formData: FormData): Promise<EndTenancyResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = endTenancySchema.safeParse({
    id: formData.get('id'),
    leaseEndDate: formData.get('leaseEndDate'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors.leaseEndDate?.[0] ?? 'Invalid input.' };
  }

  const tenant = await findAuthorizedTenant(parsed.data.id, ownerScope(session));
  if (!tenant) {
    return { error: 'Tenant not found or access denied.' };
  }

  if (parsed.data.leaseEndDate < tenant.lease_start_date) {
    return { error: 'Lease end must be on or after lease start.' };
  }

  await query('UPDATE tenants SET is_active = false, lease_end_date = $1 WHERE id = $2', [
    parsed.data.leaseEndDate,
    tenant.id,
  ]);

  redirect(`/properties/${tenant.property_id}/units/${tenant.unit_id}`);
}

export interface PaymentActionResult {
  error?: {
    amount?: string[];
    periodStart?: string[];
    periodEnd?: string[];
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
    amount: centsFromFormData(formData, 'amount', 'amountDollars'),
    periodStart: formData.get('periodStart'),
    periodEnd: formData.get('periodEnd'),
    paidDate: formData.get('paidDate'),
    paymentType: formData.get('paymentType'),
    method: formData.get('method'),
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const tenant = await findAuthorizedTenant(parsed.data.tenantId, ownerScope(session));
  if (!tenant) {
    return { error: { general: 'Tenant not found or access denied.' } };
  }
  if (!tenant.is_active) {
    return { error: { general: 'Cannot record a payment for an ended tenancy.' } };
  }

  const id = crypto.randomUUID();
  await query(
    `INSERT INTO rent_payments (id, tenant_id, unit_id, amount, period, period_start, period_end, paid_date, payment_type, method, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      id,
      tenant.id,
      tenant.unit_id,
      parsed.data.amount,
      parsed.data.periodStart.slice(0, 7),
      parsed.data.periodStart,
      parsed.data.periodEnd,
      parsed.data.paidDate,
      parsed.data.paymentType,
      parsed.data.method || null,
      parsed.data.notes || null,
    ],
  );

  redirect(`/properties/${tenant.property_id}/units/${tenant.unit_id}`);
}

async function findAuthorizedPayment(paymentId: string, scope: string | null) {
  return queryOne<{
    id: string;
    tenant_id: string;
    unit_id: string;
    property_id: string;
    property_name: string;
    unit_label: string;
    tenant_is_active: boolean;
    tenant_name: string;
    tenant_email: string | null;
    tenant_phone: string | null;
    amount: number;
    period_start: string;
    period_end: string;
    paid_date: string;
    payment_type: string;
    method: string | null;
    receipt_sent_at: string | null;
  }>(
    `SELECT rp.id, rp.tenant_id, rp.unit_id, u.property_id, p.name as property_name,
            u.unit_label, t.is_active as tenant_is_active,
            t.name as tenant_name, t.email as tenant_email, t.phone as tenant_phone,
            rp.amount, rp.period_start, rp.period_end, rp.paid_date, rp.payment_type,
            rp.method, rp.receipt_sent_at
     FROM rent_payments rp
     JOIN tenants t ON t.id = rp.tenant_id
     JOIN units u ON u.id = t.unit_id
     JOIN properties p ON p.id = u.property_id
     WHERE rp.id = $1 AND ($2::text IS NULL OR p.user_id = $2)`,
    [paymentId, scope],
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
    amount: centsFromFormData(formData, 'amount', 'amountDollars'),
    periodStart: formData.get('periodStart'),
    periodEnd: formData.get('periodEnd'),
    paidDate: formData.get('paidDate'),
    paymentType: formData.get('paymentType'),
    method: formData.get('method'),
    notes: formData.get('notes') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const payment = await findAuthorizedPayment(parsed.data.id, ownerScope(session));
  if (!payment) {
    return { error: { general: 'Payment not found or access denied.' } };
  }
  if (!payment.tenant_is_active) {
    return { error: { general: 'Cannot edit a payment from an ended tenancy.' } };
  }

  await query(
    `UPDATE rent_payments
     SET amount = $1, period = $2, period_start = $3, period_end = $4, paid_date = $5,
         payment_type = $6, method = $7, notes = $8
     WHERE id = $9`,
    [
      parsed.data.amount,
      parsed.data.periodStart.slice(0, 7),
      parsed.data.periodStart,
      parsed.data.periodEnd,
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

  const payment = await findAuthorizedPayment(id, ownerScope(session));
  if (!payment) return;
  if (!payment.tenant_is_active) return;

  await query('DELETE FROM rent_payments WHERE id = $1', [payment.id]);
  redirect(`/properties/${payment.property_id}/units/${payment.unit_id}`);
}

// Manually sends the "payment received" email + SMS for one ledger entry.
// Guarded so it can only ever fire once per entry (receipt_sent_at), which
// also caps the SMS cost. Each channel is attempted independently.
export async function sendPaymentReceiptNotice(
  _prevState: PaymentActionResult,
  formData: FormData,
): Promise<PaymentActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const id = formData.get('id');
  if (typeof id !== 'string') {
    return { error: { general: 'Payment not found or access denied.' } };
  }

  const payment = await findAuthorizedPayment(id, ownerScope(session));
  if (!payment) {
    return { error: { general: 'Payment not found or access denied.' } };
  }
  if (payment.receipt_sent_at) {
    return { error: { general: 'Receipt already sent.' } };
  }
  if (!payment.tenant_email && !payment.tenant_phone) {
    return { error: { general: 'Tenant has no email or phone number.' } };
  }

  let sent = false;
  let anyFailed = false;
  let nothingConfigured = true;

  if (payment.tenant_email) {
    try {
      const ok = await sendPaymentReceipt(payment.tenant_email, {
        tenantName: payment.tenant_name,
        propertyName: payment.property_name,
        unitLabel: payment.unit_label,
        amount: payment.amount,
        paidDate: payment.paid_date,
        periodStart: payment.period_start,
        periodEnd: payment.period_end,
        paymentType: payment.payment_type,
        method: payment.method,
      });
      if (ok) {
        sent = true;
        nothingConfigured = false;
      }
    } catch (error) {
      console.error('Failed to send payment receipt email:', error);
      anyFailed = true;
      nothingConfigured = false;
    }
  }

  if (payment.tenant_phone) {
    try {
      const ok = await sendSmsPaymentReceipt(payment.tenant_phone, {
        tenantName: payment.tenant_name,
        amount: payment.amount,
        periodStart: payment.period_start,
        periodEnd: payment.period_end,
      });
      if (ok) {
        sent = true;
        nothingConfigured = false;
      }
    } catch (error) {
      console.error('Failed to send payment receipt SMS:', error);
      anyFailed = true;
      nothingConfigured = false;
    }
  }

  if (!sent) {
    return {
      error: {
        general: nothingConfigured
          ? 'Email and SMS are not configured.'
          : 'Failed to send receipt. Please try again.',
      },
    };
  }
  if (anyFailed) {
    console.warn(`Payment receipt ${payment.id}: one channel failed, marking as sent anyway.`);
  }

  await query('UPDATE rent_payments SET receipt_sent_at = now() WHERE id = $1', [payment.id]);
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

async function findAuthorizedExpense(expenseId: string, scope: string | null) {
  return queryOne<{ id: string; unit_id: string; property_id: string }>(
    `SELECT e.id, e.unit_id, e.property_id FROM expenses e
     JOIN units u ON u.id = e.unit_id
     JOIN properties p ON p.id = u.property_id
     WHERE e.id = $1 AND ($2::text IS NULL OR p.user_id = $2)`,
    [expenseId, scope],
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
    amount: centsFromFormData(formData, 'amount', 'amountDollars'),
    expenseDate: formData.get('expenseDate'),
    remarks: formData.get('remarks') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const unit = await findAuthorizedUnit(parsed.data.unitId, ownerScope(session));
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
    amount: centsFromFormData(formData, 'amount', 'amountDollars'),
    expenseDate: formData.get('expenseDate'),
    remarks: formData.get('remarks') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const expense = await findAuthorizedExpense(parsed.data.id, ownerScope(session));
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

  const expense = await findAuthorizedExpense(id, ownerScope(session));
  if (!expense) return;

  await query('DELETE FROM expenses WHERE id = $1', [expense.id]);
  redirect(`/properties/${expense.property_id}/units/${expense.unit_id}`);
}

export interface DocumentActionResult {
  error?: string;
}

export async function uploadTenantDocument(
  _prevState: DocumentActionResult,
  formData: FormData,
): Promise<DocumentActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const tenantId = formData.get('tenantId');
  if (typeof tenantId !== 'string' || !tenantId) {
    return { error: 'Invalid tenant id.' };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || !file.name) {
    return { error: 'Please choose a file to upload.' };
  }
  const fileError = validateDocumentFile(file);
  if (fileError) {
    return { error: fileError };
  }

  if (!isDriveConfigured()) {
    return { error: 'Document storage is not configured.' };
  }

  const tenant = await findAuthorizedTenant(tenantId, ownerScope(session));
  if (!tenant) {
    return { error: 'Tenant not found or access denied.' };
  }

  let driveFileId: string | null;
  try {
    driveFileId = await uploadFileToDrive(file, tenant.id);
  } catch (err) {
    console.error('Failed to upload tenant document to Google Drive:', err);
    return { error: 'Failed to upload to Google Drive. Please try again.' };
  }
  if (!driveFileId) {
    return { error: 'Document storage is not configured.' };
  }

  await query(
    `INSERT INTO tenant_documents (id, tenant_id, drive_file_id, file_name, mime_type, size_bytes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [crypto.randomUUID(), tenant.id, driveFileId, file.name, file.type, file.size],
  );

  redirect(`/properties/${tenant.property_id}/units/${tenant.unit_id}`);
}

export async function deleteTenantDocument(formData: FormData): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const id = formData.get('id');
  if (typeof id !== 'string') return;

  const doc = await findAuthorizedDocument(id, ownerScope(session));
  if (!doc) return;

  // Drive first: if it fails the row survives and the user can retry
  // (deleteDriveFile tolerates 404, so a retry after partial success works).
  try {
    await deleteDriveFile(doc.drive_file_id);
  } catch (err) {
    console.error('Failed to delete tenant document from Google Drive:', err);
    return;
  }

  await query('DELETE FROM tenant_documents WHERE id = $1', [doc.id]);
  redirect(`/properties/${doc.property_id}/units/${doc.unit_id}`);
}
