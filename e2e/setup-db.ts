import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { Client } from 'pg';
import { E2E_EMAIL, E2E_PASSWORD } from './test-user';

const adminURL =
  process.env.E2E_ADMIN_DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54342/postgres';
const databaseURL =
  process.env.DATABASE_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54342/8turf_e2e';
const databaseName = new URL(databaseURL).pathname.slice(1);

if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) {
  throw new Error(`Unsafe E2E database name: ${databaseName}`);
}

const admin = new Client({ connectionString: adminURL });
await admin.connect();

try {
  await admin.query(
    `select pg_terminate_backend(pid)
     from pg_stat_activity
     where datname = $1 and pid <> pg_backend_pid()`,
    [databaseName],
  );
  await admin.query(`drop database if exists "${databaseName}"`);
  await admin.query(`create database "${databaseName}"`);
} finally {
  await admin.end();
}

const database = new Client({ connectionString: databaseURL });
await database.connect();

try {
  const migrationsDirectory = path.join(process.cwd(), 'supabase', 'migrations');
  const migrationFiles = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of migrationFiles) {
    await database.query(await readFile(path.join(migrationsDirectory, file), 'utf8'));
  }
} finally {
  await database.end();
}

process.env.DATABASE_URL = databaseURL;
process.env.BETTER_AUTH_SECRET ??= '8turf-e2e-secret-at-least-32-characters';

const { auth } = await import('../lib/auth');
const { pool } = await import('../lib/db');

await auth.api.createUser({
  body: {
    email: E2E_EMAIL,
    name: 'E2E Admin',
    password: E2E_PASSWORD,
    role: 'admin',
  },
});

await pool.end();
