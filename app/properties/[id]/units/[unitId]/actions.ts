'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { updateUnitSchema } from '@/lib/validation';

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
