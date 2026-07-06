// One-time migration of data/app.db (bun:sqlite) into Supabase Postgres.
// Sessions and verification tokens are ephemeral and intentionally not migrated —
// users simply log in again. Run: bun run scripts/migrate-sqlite-to-postgres.ts
import { Database } from 'bun:sqlite';

import { pool } from '@/lib/db';

const sqlitePath = process.argv[2] || 'data/app.db';
const sqlite = new Database(sqlitePath, { readonly: true });

// SQLite datetime('now') strings are UTC without a timezone marker
function toUtc(value: string | null): string | null {
  if (!value) return null;
  return /[Zz]|[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value}Z`;
}

type Row = Record<string, string | number | null>;

async function insert(table: string, columns: string[], rows: Row[]) {
  for (const row of rows) {
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const quoted = columns.map((c) => `"${c}"`).join(', ');
    await pool.query(
      `INSERT INTO "${table}" (${quoted}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
      columns.map((c) => row[c]),
    );
  }
  console.log(`${table}: ${rows.length} rows`);
}

const users = sqlite.query<Row, []>('SELECT * FROM user').all();
await insert(
  'user',
  [
    'id',
    'name',
    'email',
    'emailVerified',
    'image',
    'role',
    'banned',
    'banReason',
    'banExpires',
    'createdAt',
    'updatedAt',
  ],
  users.map((u) => ({
    ...u,
    emailVerified: u.emailVerified ? 'true' : 'false',
    banned: u.banned == null ? null : u.banned ? 'true' : 'false',
    banExpires: toUtc(u.banExpires as string | null),
    createdAt: toUtc(u.createdAt as string),
    updatedAt: toUtc(u.updatedAt as string),
  })),
);

const accounts = sqlite.query<Row, []>('SELECT * FROM account').all();
await insert(
  'account',
  [
    'id',
    'userId',
    'accountId',
    'providerId',
    'accessToken',
    'refreshToken',
    'accessTokenExpiresAt',
    'refreshTokenExpiresAt',
    'scope',
    'idToken',
    'password',
    'createdAt',
    'updatedAt',
  ],
  accounts.map((a) => ({
    ...a,
    accessTokenExpiresAt: toUtc(a.accessTokenExpiresAt as string | null),
    refreshTokenExpiresAt: toUtc(a.refreshTokenExpiresAt as string | null),
    createdAt: toUtc(a.createdAt as string),
    updatedAt: toUtc(a.updatedAt as string),
  })),
);

const timestamps = (r: Row) => ({
  created_at: toUtc(r.created_at as string),
  updated_at: toUtc(r.updated_at as string),
});

const properties = sqlite.query<Row, []>('SELECT * FROM properties').all();
await insert(
  'properties',
  ['id', 'user_id', 'name', 'address', 'archived_at', 'created_at', 'updated_at'],
  properties.map((r) => ({ ...r, ...timestamps(r) })),
);

const units = sqlite.query<Row, []>('SELECT * FROM units').all();
await insert(
  'units',
  [
    'id',
    'property_id',
    'unit_label',
    'bedrooms',
    'bathrooms',
    'rent_amount',
    'archived_at',
    'created_at',
    'updated_at',
  ],
  units.map((r) => ({ ...r, ...timestamps(r) })),
);

const tenants = sqlite.query<Row, []>('SELECT * FROM tenants').all();
await insert(
  'tenants',
  [
    'id',
    'unit_id',
    'name',
    'email',
    'phone',
    'rent_amount',
    'lease_start_date',
    'lease_end_date',
    'is_active',
    'created_at',
    'updated_at',
  ],
  tenants.map((r) => ({ ...r, ...timestamps(r), is_active: r.is_active ? 'true' : 'false' })),
);

const payments = sqlite.query<Row, []>('SELECT * FROM rent_payments').all();
await insert(
  'rent_payments',
  [
    'id',
    'tenant_id',
    'unit_id',
    'amount',
    'period',
    'paid_date',
    'method',
    'notes',
    'payment_type',
    'created_at',
    'updated_at',
  ],
  payments.map((r) => ({ ...r, ...timestamps(r) })),
);

const expenses = sqlite.query<Row, []>('SELECT * FROM expenses').all();
await insert(
  'expenses',
  [
    'id',
    'property_id',
    'unit_id',
    'category',
    'amount',
    'expense_date',
    'remarks',
    'created_at',
    'updated_at',
  ],
  expenses.map((r) => ({ ...r, ...timestamps(r) })),
);

await pool.end();
console.log('Done.');
