'use server';

import { randomUUID } from 'node:crypto';
import { headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { execute, queryOne } from '@/lib/db';
import {
  createMaintenanceContactSchema,
  maintenanceContactStateSchema,
  updateMaintenanceContactSchema,
} from '@/lib/validation';

export interface MaintenanceContactActionResult {
  success?: boolean;
  error?: {
    name?: string[];
    company?: string[];
    phone?: string[];
    email?: string[];
    serviceArea?: string[];
    availability?: string[];
    notes?: string[];
    services?: string[];
    ownerId?: string[];
    general?: string;
  };
}

async function requireSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');
  return session;
}

function contactInput(formData: FormData) {
  return {
    name: formData.get('name'),
    company: formData.get('company'),
    phone: formData.get('phone'),
    email: formData.get('email'),
    serviceArea: formData.get('serviceArea'),
    availability: formData.get('availability'),
    notes: formData.get('notes'),
    services: formData.getAll('services'),
    isPreferred: formData.get('isPreferred') === 'on',
    ownerId: formData.get('ownerId') ?? '',
  };
}

function nullable(value: string) {
  return value || null;
}

async function resolveOwnerId(
  session: Awaited<ReturnType<typeof requireSession>>,
  requestedOwnerId: string,
) {
  if (session.user.role !== 'admin') return session.user.id;
  const ownerId = requestedOwnerId || session.user.id;
  const owner = await queryOne<{ id: string }>('SELECT id FROM "user" WHERE id = $1', [ownerId]);
  return owner?.id ?? null;
}

export async function createMaintenanceContact(
  _previous: MaintenanceContactActionResult,
  formData: FormData,
): Promise<MaintenanceContactActionResult> {
  const session = await requireSession();
  const parsed = createMaintenanceContactSchema.safeParse(contactInput(formData));
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const ownerId = await resolveOwnerId(session, parsed.data.ownerId ?? '');
  if (!ownerId) return { error: { ownerId: ['Select a valid owner'] } };

  try {
    await execute(
      `INSERT INTO maintenance_contacts
         (id, user_id, name, company, phone, email, service_area, availability, notes, services, is_preferred)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        randomUUID(),
        ownerId,
        parsed.data.name,
        nullable(parsed.data.company ?? ''),
        nullable(parsed.data.phone ?? ''),
        nullable(parsed.data.email ?? ''),
        nullable(parsed.data.serviceArea ?? ''),
        nullable(parsed.data.availability ?? ''),
        nullable(parsed.data.notes ?? ''),
        parsed.data.services,
        parsed.data.isPreferred,
      ],
    );
  } catch (error) {
    console.error('Failed to create maintenance contact:', error);
    return { error: { general: 'Failed to create contact.' } };
  }

  revalidatePath('/maintenance/contacts');
  return { success: true };
}

export async function updateMaintenanceContact(
  _previous: MaintenanceContactActionResult,
  formData: FormData,
): Promise<MaintenanceContactActionResult> {
  const session = await requireSession();
  const parsed = updateMaintenanceContactSchema.safeParse({
    ...contactInput(formData),
    id: formData.get('id'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  try {
    const updated = await execute(
      `UPDATE maintenance_contacts
       SET name = $1, company = $2, phone = $3, email = $4, service_area = $5,
           availability = $6, notes = $7, services = $8, is_preferred = $9
       WHERE id = $10 AND ($11::boolean OR user_id = $12)`,
      [
        parsed.data.name,
        nullable(parsed.data.company ?? ''),
        nullable(parsed.data.phone ?? ''),
        nullable(parsed.data.email ?? ''),
        nullable(parsed.data.serviceArea ?? ''),
        nullable(parsed.data.availability ?? ''),
        nullable(parsed.data.notes ?? ''),
        parsed.data.services,
        parsed.data.isPreferred,
        parsed.data.id,
        session.user.role === 'admin',
        session.user.id,
      ],
    );
    if (!updated) return { error: { general: 'Contact not found.' } };
  } catch (error) {
    console.error('Failed to update maintenance contact:', error);
    return { error: { general: 'Failed to update contact.' } };
  }

  revalidatePath('/maintenance/contacts');
  return { success: true };
}

export async function setMaintenanceContactPreferred(formData: FormData) {
  const session = await requireSession();
  const parsed = maintenanceContactStateSchema.safeParse({
    id: formData.get('id'),
    value: formData.get('value'),
  });
  if (!parsed.success) return;

  await execute(
    `UPDATE maintenance_contacts
     SET is_preferred = $1
     WHERE id = $2 AND ($3::boolean OR user_id = $4)`,
    [parsed.data.value === 'true', parsed.data.id, session.user.role === 'admin', session.user.id],
  );
  revalidatePath('/maintenance/contacts');
}

export async function setMaintenanceContactArchived(formData: FormData) {
  const session = await requireSession();
  const parsed = maintenanceContactStateSchema.safeParse({
    id: formData.get('id'),
    value: formData.get('value'),
  });
  if (!parsed.success) return;

  await execute(
    `UPDATE maintenance_contacts
     SET archived_at = CASE WHEN $1 THEN now() ELSE NULL END
     WHERE id = $2 AND ($3::boolean OR user_id = $4)`,
    [parsed.data.value === 'true', parsed.data.id, session.user.role === 'admin', session.user.id],
  );
  revalidatePath('/maintenance/contacts');
}
