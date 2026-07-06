import { Pool, types } from 'pg';

// Return timestamptz/timestamp/date columns as plain strings — all rendering and
// comparison code in this app works with ISO strings, not Date objects.
types.setTypeParser(types.builtins.TIMESTAMPTZ, (v) => v);
types.setTypeParser(types.builtins.TIMESTAMP, (v) => v);
types.setTypeParser(types.builtins.DATE, (v) => v);

const connectionString =
  process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:54342/postgres';

// Survive Next.js dev-server module reloads with a single pool
const globalForDb = globalThis as unknown as { pgPool?: Pool };

export const pool = globalForDb.pgPool ?? new Pool({ connectionString });
globalForDb.pgPool = pool;

export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T>(text: string, params: unknown[] = []): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// For INSERT/UPDATE/DELETE where the caller needs the affected-row count
export async function execute(text: string, params: unknown[] = []): Promise<number> {
  const result = await pool.query(text, params);
  return result.rowCount ?? 0;
}
