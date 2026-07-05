'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import {
  updateUnitSchema,
  assignTenantSchema,
  updateTenantSchema,
  endTenancySchema,
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
  return db
    .query<{ id: string; property_id: string }, [string, string]>(
      `SELECT u.id, u.property_id FROM units u
       JOIN properties p ON p.id = u.property_id
       WHERE u.id = ? AND p.user_id = ?`,
    )
    .get(unitId, userId);
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

  db.run(
    'UPDATE units SET unit_label = ?, bedrooms = ?, bathrooms = ?, rent_amount = ? WHERE id = ?',
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

  const id = formData.get('id');
  if (typeof id !== 'string') return;

  const unit = await findAuthorizedUnit(id, session.user.id);
  if (!unit) return;

  db.run("UPDATE units SET archived_at = datetime('now') WHERE id = ?", [unit.id]);
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

  const tenantCount = db
    .query<{ count: number }, [string]>('SELECT COUNT(*) as count FROM tenants WHERE unit_id = ?')
    .get(unit.id);
  if (tenantCount && tenantCount.count > 0) {
    return { error: 'This unit has tenant history — archive it instead of deleting.' };
  }

  db.run('DELETE FROM units WHERE id = ?', [unit.id]);
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
    db.run(
      `INSERT INTO tenants (id, unit_id, name, email, phone, rent_amount, lease_start_date, lease_end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
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
    const message = err instanceof Error ? err.message : '';
    if (message.includes('UNIQUE constraint failed') && message.includes('tenants.unit_id')) {
      return { error: { general: 'This unit already has an active tenant.' } };
    }
    return { error: { general: 'Failed to assign tenant. Please try again.' } };
  }

  redirect(`/properties/${unit.property_id}/units/${unit.id}`);
}

async function findAuthorizedTenant(tenantId: string, userId: string) {
  return db
    .query<{ id: string; unit_id: string; property_id: string }, [string, string]>(
      `SELECT t.id, t.unit_id, u.property_id FROM tenants t
       JOIN units u ON u.id = t.unit_id
       JOIN properties p ON p.id = u.property_id
       WHERE t.id = ? AND p.user_id = ?`,
    )
    .get(tenantId, userId);
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

  db.run(
    `UPDATE tenants SET name = ?, email = ?, phone = ?, rent_amount = ?, lease_start_date = ?, lease_end_date = ?
     WHERE id = ?`,
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

  db.run('UPDATE tenants SET is_active = 0, lease_end_date = ? WHERE id = ?', [
    parsed.data.leaseEndDate,
    tenant.id,
  ]);

  redirect(`/properties/${tenant.property_id}/units/${tenant.unit_id}`);
}
