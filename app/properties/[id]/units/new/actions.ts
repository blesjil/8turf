'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { createUnitSchema } from '@/lib/validation';

export interface UnitActionResult {
  error?: {
    unitLabel?: string[];
    bedrooms?: string[];
    bathrooms?: string[];
    rentAmount?: string[];
    general?: string;
  };
}

export async function createUnit(
  _prevState: UnitActionResult,
  formData: FormData,
): Promise<UnitActionResult> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/authenticate');

  const parsed = createUnitSchema.safeParse({
    propertyId: formData.get('propertyId'),
    unitLabel: formData.get('unitLabel'),
    bedrooms: formData.get('bedrooms'),
    bathrooms: formData.get('bathrooms'),
    rentAmount: formData.get('rentAmount'),
  });
  if (!parsed.success) {
    return { error: parsed.error.flatten().fieldErrors };
  }

  const property = db
    .query<{ id: string }, [string, string]>(
      'SELECT id FROM properties WHERE id = ? AND user_id = ?',
    )
    .get(parsed.data.propertyId, session.user.id);
  if (!property) {
    return { error: { general: 'Property not found or access denied.' } };
  }

  const id = crypto.randomUUID();
  db.run(
    `INSERT INTO units (id, property_id, unit_label, bedrooms, bathrooms, rent_amount)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      id,
      property.id,
      parsed.data.unitLabel,
      parsed.data.bedrooms,
      parsed.data.bathrooms,
      parsed.data.rentAmount,
    ],
  );

  redirect(`/properties/${property.id}/units/${id}`);
}
