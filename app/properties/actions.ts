'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createPropertySchema, updatePropertySchema } from '@/lib/validation';

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
  db.run('INSERT INTO properties (id, user_id, name, address) VALUES (?, ?, ?, ?)', [
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

  const changes = db.run(
    'UPDATE properties SET name = ?, address = ? WHERE id = ? AND user_id = ?',
    [parsed.data.name, parsed.data.address, parsed.data.id, session.user.id],
  );
  if (changes.changes === 0) {
    return { error: { general: 'Property not found or access denied.' } };
  }

  redirect(`/properties/${parsed.data.id}`);
}

export async function archiveProperty(formData: FormData): Promise<void> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const id = formData.get('id');
  if (typeof id !== 'string') return;

  db.run("UPDATE properties SET archived_at = datetime('now') WHERE id = ? AND user_id = ?", [
    id,
    session.user.id,
  ]);

  redirect('/dashboard');
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

  const property = db
    .query<{ id: string }, [string, string]>(
      'SELECT id FROM properties WHERE id = ? AND user_id = ?',
    )
    .get(id, session.user.id);
  if (!property) {
    return { error: 'Property not found or access denied.' };
  }

  const unitCount = db
    .query<{ count: number }, [string]>('SELECT COUNT(*) as count FROM units WHERE property_id = ?')
    .get(id);
  if (unitCount && unitCount.count > 0) {
    return { error: 'This property still has units — archive it instead of deleting.' };
  }

  db.run('DELETE FROM properties WHERE id = ? AND user_id = ?', [id, session.user.id]);
  redirect('/dashboard');
}
