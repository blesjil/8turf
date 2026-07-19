import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { Client } from 'pg';

const adminUrl =
  process.env.RLS_VERIFY_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54342/postgres';
const databaseName = `rls_verify_${Date.now()}`;
const migrationsDirectory = path.join(process.cwd(), 'supabase', 'migrations');
const rollbackPath = path.join(
  process.cwd(),
  'supabase',
  'rollbacks',
  '0011_enable_rls_and_lock_down_data_api.sql',
);

const expectedTables = [
  'account',
  'expenses',
  'login_attempts',
  'payment_reminders',
  'properties',
  'rent_payments',
  'session',
  'tenant_documents',
  'tenants',
  'units',
  'user',
  'verification',
];

function databaseUrlFor(database: string) {
  const url = new URL(adminUrl);
  url.pathname = `/${database}`;
  return url.toString();
}

async function getRlsState(client: Client) {
  const result = await client.query<{
    table_name: string;
    rls_enabled: boolean;
    rls_forced: boolean;
  }>(
    `
    select
      c.relname as table_name,
      c.relrowsecurity as rls_enabled,
      c.relforcerowsecurity as rls_forced
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p')
      and n.nspname = 'public'
      and c.relname = any($1::text[])
    order by c.relname
  `,
    [expectedTables],
  );
  return result.rows;
}

function assertRlsState(rows: Awaited<ReturnType<typeof getRlsState>>, expectedEnabled: boolean) {
  if (rows.length !== expectedTables.length) {
    throw new Error(`Expected ${expectedTables.length} tables, found ${rows.length}`);
  }

  for (const row of rows) {
    if (row.rls_enabled !== expectedEnabled) {
      throw new Error(
        `${row.table_name}: expected RLS enabled=${expectedEnabled}, got ${row.rls_enabled}`,
      );
    }
    if (row.rls_forced) {
      throw new Error(`${row.table_name}: FORCE ROW LEVEL SECURITY must remain disabled`);
    }
  }
}

async function assertAnonDenied(client: Client) {
  const privileges = await client.query<{ table_name: string; can_select: boolean }>(
    `
    select
      c.relname as table_name,
      has_table_privilege('anon', c.oid, 'SELECT') as can_select
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where c.relkind in ('r', 'p')
      and n.nspname = 'public'
      and c.relname = any($1::text[])
    order by c.relname
  `,
    [expectedTables],
  );

  const exposed = privileges.rows.filter((row) => row.can_select);
  if (exposed.length > 0) {
    throw new Error(`anon still has SELECT on: ${exposed.map((row) => row.table_name).join(', ')}`);
  }

  await client.query('set role anon');
  try {
    await client.query('select * from public.properties limit 1');
    throw new Error('anon unexpectedly selected from public.properties');
  } catch (error) {
    if (!(error instanceof Error) || !error.message.includes('permission denied')) {
      throw error;
    }
  } finally {
    await client.query('reset role');
  }
}

async function assertOwnerStillWorks(client: Client) {
  const role = await client.query<{ current_user: string }>('select current_user');
  if (role.rows[0]?.current_user !== 'postgres') {
    throw new Error(`Expected postgres verification role, got ${role.rows[0]?.current_user}`);
  }

  await client.query('select count(*) from public.properties');
  await client.query('select count(*) from public.session');
}

async function assertFunctionSearchPath(client: Client, expectedHardened: boolean) {
  const result = await client.query<{ function_config: string }>(`
    select coalesce(array_to_string(p.proconfig, ','), '') as function_config
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'set_updated_at'
  `);
  const hardened = result.rows[0]?.function_config.includes('search_path=""') ?? false;
  if (hardened !== expectedHardened) {
    throw new Error(
      `Expected set_updated_at search_path hardened=${expectedHardened}, got ${hardened}`,
    );
  }
}

async function assertOwnerCrudStillWorks(client: Client) {
  await client.query('begin');
  try {
    await client.query(`
      insert into public."user" (id, name, email)
      values ('rls-user', 'RLS Verification', 'rls-verification@example.com');

      insert into public.account (id, "userId", "accountId", "providerId")
      values ('rls-account', 'rls-user', 'rls-verification@example.com', 'credential');

      insert into public.session (id, "userId", token, "expiresAt")
      values ('rls-session', 'rls-user', 'rls-token', now() + interval '10 minutes');

      insert into public.verification (id, identifier, value, "expiresAt")
      values ('rls-verification', 'rls-verification@example.com', 'value', now() + interval '10 minutes');

      insert into public.login_attempts (email, failed_count)
      values ('rls-verification@example.com', 1);

      insert into public.properties (id, user_id, name, address)
      values ('rls-property', 'rls-user', 'RLS Property', 'Verification address');

      insert into public.units (
        id, property_id, unit_label, bedrooms, bathrooms, rent_amount
      ) values ('rls-unit', 'rls-property', 'RLS Unit', 1, 1, 10000);

      insert into public.tenants (
        id, unit_id, name, email, rent_amount, deposit_amount, lease_start_date
      ) values (
        'rls-tenant',
        'rls-unit',
        'RLS Tenant',
        'rls-tenant@example.com',
        10000,
        10000,
        '2026-01-01'
      );

      insert into public.rent_payments (
        id,
        tenant_id,
        unit_id,
        amount,
        period,
        paid_date,
        period_start,
        period_end
      ) values (
        'rls-payment',
        'rls-tenant',
        'rls-unit',
        10000,
        '2026-01',
        '2026-01-01',
        '2026-01-01',
        '2026-01-31'
      );

      insert into public.expenses (
        id, property_id, unit_id, category, amount, expense_date
      ) values (
        'rls-expense',
        'rls-property',
        'rls-unit',
        'repair',
        100,
        '2026-01-01'
      );

      insert into public.payment_reminders (
        id, tenant_id, period, sent_to, amount_due
      ) values (
        'rls-reminder',
        'rls-tenant',
        '2026-01',
        'rls-tenant@example.com',
        10000
      );

      insert into public.tenant_documents (
        id, tenant_id, drive_file_id, file_name, mime_type, size_bytes
      ) values (
        'rls-document',
        'rls-tenant',
        'rls-drive-file',
        'verification.pdf',
        'application/pdf',
        100
      );

      update public.properties
      set name = 'RLS Property Updated'
      where id = 'rls-property';
    `);

    const joined = await client.query<{ property_name: string }>(`
      select p.name as property_name
      from public.properties p
      join public.units u on u.property_id = p.id
      join public.tenants t on t.unit_id = u.id
      where t.id = 'rls-tenant'
    `);
    if (joined.rows[0]?.property_name !== 'RLS Property Updated') {
      throw new Error('Owner CRUD verification did not read the updated property');
    }

    await client.query(`
      delete from public.tenant_documents where id = 'rls-document';
      delete from public.payment_reminders where id = 'rls-reminder';
      delete from public.rent_payments where id = 'rls-payment';
      delete from public.expenses where id = 'rls-expense';
      delete from public.tenants where id = 'rls-tenant';
      delete from public.units where id = 'rls-unit';
      delete from public.properties where id = 'rls-property';
      delete from public.session where id = 'rls-session';
      delete from public.account where id = 'rls-account';
      delete from public.verification where id = 'rls-verification';
      delete from public.login_attempts where email = 'rls-verification@example.com';
      delete from public."user" where id = 'rls-user';
    `);
  } finally {
    await client.query('rollback');
  }
}

async function main() {
  const admin = new Client({ connectionString: adminUrl });
  await admin.connect();

  try {
    await admin.query(`create database "${databaseName}"`);
    const verification = new Client({ connectionString: databaseUrlFor(databaseName) });
    await verification.connect();

    try {
      const migrationFiles = (await readdir(migrationsDirectory))
        .filter((file) => file.endsWith('.sql'))
        .sort();

      for (const file of migrationFiles) {
        const sql = await readFile(path.join(migrationsDirectory, file), 'utf8');
        await verification.query(sql);
      }

      assertRlsState(await getRlsState(verification), true);
      await assertAnonDenied(verification);
      await assertOwnerStillWorks(verification);
      await assertFunctionSearchPath(verification, true);
      await assertOwnerCrudStillWorks(verification);

      const rollbackSql = await readFile(rollbackPath, 'utf8');
      await verification.query(rollbackSql);
      assertRlsState(await getRlsState(verification), false);
      await assertOwnerStillWorks(verification);
      await assertFunctionSearchPath(verification, false);

      const forwardSql = await readFile(
        path.join(migrationsDirectory, '0011_enable_rls_and_lock_down_data_api.sql'),
        'utf8',
      );
      await verification.query(forwardSql);
      assertRlsState(await getRlsState(verification), true);
      await assertAnonDenied(verification);
      await assertOwnerStillWorks(verification);
      await assertFunctionSearchPath(verification, true);
      await assertOwnerCrudStillWorks(verification);

      console.log(
        `Verified ${migrationFiles.length} migrations, rollback, and reapply on ${expectedTables.length} RLS tables.`,
      );
    } finally {
      await verification.end();
    }
  } finally {
    await admin.query(`select pg_terminate_backend(pid) from pg_stat_activity where datname = $1`, [
      databaseName,
    ]);
    await admin.query(`drop database if exists "${databaseName}"`);
    await admin.end();
  }
}

await main();
