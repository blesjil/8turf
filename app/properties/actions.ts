'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { execute, query, queryOne } from '@/lib/db';
import {
  createPropertySchema,
  updatePropertySchema,
  recordPropertyExpenseSchema,
  updatePropertyExpenseSchema,
} from '@/lib/validation';

export interface PropertyActionResult {
  error?: { name?: string[]; address?: string[]; general?: string };
}

export async function createProperty(
  _prevState: PropertyActionResult,
  formData: FormData,
): Promise<PropertyActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = createPropertySchema.safeParse({
    name: formData.get('name'),
    address: formData.get('address'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const id = crypto.randomUUID();
  await query('INSERT INTO properties (id, user_id, name, address) VALUES ($1, $2, $3, $4)', [
    id,
    session.user.id,
    parsed.data.name,
    parsed.data.address,
  ]);

  redirect(`/properties/${id}`);
}

export async function updateProperty(
  _prevState: PropertyActionResult,
  formData: FormData,
): Promise<PropertyActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = updatePropertySchema.safeParse({
    id: formData.get('id'),
    name: formData.get('name'),
    address: formData.get('address'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const changes = await execute(
    'UPDATE properties SET name = $1, address = $2 WHERE id = $3 AND user_id = $4',
    [parsed.data.name, parsed.data.address, parsed.data.id, session.user.id],
  );
  if (changes === 0) {
    return { error: { general: 'Property not found or access denied.' } };
  }

  redirect(`/properties/${parsed.data.id}`);
}

export async function archiveProperty(formData: FormData): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');
  if (session.user.role !== 'admin') redirect('/dashboard');

  const id = formData.get('id');
  if (typeof id !== 'string') return;

  await query('UPDATE properties SET archived_at = now() WHERE id = $1 AND user_id = $2', [
    id,
    session.user.id,
  ]);

  redirect('/dashboard');
}

export async function unarchiveProperty(formData: FormData): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');
  if (session.user.role !== 'admin') redirect('/dashboard');

  const id = formData.get('id');
  if (typeof id !== 'string') return;

  await query('UPDATE properties SET archived_at = NULL WHERE id = $1 AND user_id = $2', [
    id,
    session.user.id,
  ]);

  redirect('/properties/archived');
}

export interface DeletePropertyResult {
  error?: string;
}

export async function deleteProperty(
  _prevState: DeletePropertyResult,
  formData: FormData,
): Promise<DeletePropertyResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const id = formData.get('id');
  if (typeof id !== 'string') {
    return { error: 'Invalid property id.' };
  }

  const property = await queryOne<{ id: string }>(
    'SELECT id FROM properties WHERE id = $1 AND user_id = $2',
    [id, session.user.id],
  );
  if (!property) {
    return { error: 'Property not found or access denied.' };
  }

  const unitCount = await queryOne<{ count: number }>(
    'SELECT COUNT(*)::int as count FROM units WHERE property_id = $1',
    [id],
  );
  if (unitCount && unitCount.count > 0) {
    return { error: 'This property still has units — archive it instead of deleting.' };
  }

  await query('DELETE FROM properties WHERE id = $1 AND user_id = $2', [id, session.user.id]);
  redirect('/dashboard');
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

async function findAuthorizedPropertyExpense(expenseId: string, userId: string) {
  return queryOne<{ id: string; property_id: string }>(
    `SELECT e.id, e.property_id FROM expenses e
     JOIN properties p ON p.id = e.property_id
     WHERE e.id = $1 AND e.unit_id IS NULL AND p.user_id = $2`,
    [expenseId, userId],
  );
}

export async function recordPropertyExpense(
  _prevState: ExpenseActionResult,
  formData: FormData,
): Promise<ExpenseActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = recordPropertyExpenseSchema.safeParse({
    propertyId: formData.get('propertyId'),
    category: formData.get('category'),
    amount: formData.get('amount'),
    expenseDate: formData.get('expenseDate'),
    remarks: formData.get('remarks') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const property = await queryOne<{ id: string }>(
    'SELECT id FROM properties WHERE id = $1 AND user_id = $2',
    [parsed.data.propertyId, session.user.id],
  );
  if (!property) {
    return { error: { general: 'Property not found or access denied.' } };
  }

  const id = crypto.randomUUID();
  await query(
    `INSERT INTO expenses (id, property_id, category, amount, expense_date, remarks)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      id,
      property.id,
      parsed.data.category,
      parsed.data.amount,
      parsed.data.expenseDate,
      parsed.data.remarks || null,
    ],
  );

  redirect(`/properties/${property.id}`);
}

export async function updatePropertyExpense(
  _prevState: ExpenseActionResult,
  formData: FormData,
): Promise<ExpenseActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = updatePropertyExpenseSchema.safeParse({
    id: formData.get('id'),
    category: formData.get('category'),
    amount: formData.get('amount'),
    expenseDate: formData.get('expenseDate'),
    remarks: formData.get('remarks') ?? '',
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const expense = await findAuthorizedPropertyExpense(parsed.data.id, session.user.id);
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

  redirect(`/properties/${expense.property_id}`);
}

export async function deletePropertyExpense(formData: FormData): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const id = formData.get('id');
  if (typeof id !== 'string') return;

  const expense = await findAuthorizedPropertyExpense(id, session.user.id);
  if (!expense) return;

  await query('DELETE FROM expenses WHERE id = $1', [expense.id]);
  redirect(`/properties/${expense.property_id}`);
}
