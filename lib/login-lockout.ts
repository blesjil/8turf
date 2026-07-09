import { execute, queryOne } from './db';

export const MAX_ATTEMPTS = 3;
export const LOCKOUT_MS = 60 * 60 * 1000;

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  return normalized || null;
}

// Atomically consumes one login attempt for `email` and reports whether the
// account is now locked. The check-and-increment happens inside a single
// UPSERT, so concurrent sign-in requests for the same email serialize on
// Postgres's row lock instead of every request reading "not locked yet"
// before any of them records a failure (which would let more than
// MAX_ATTEMPTS credential checks race through before the lock applies).
// A failure after an expired lock restarts the count at 1; a row already
// under an active lock is left untouched; reaching MAX_ATTEMPTS re-locks.
export async function registerAttempt(
  email: string,
): Promise<{ locked: boolean; remainingMs: number }> {
  const nextCount = `case
    when login_attempts.locked_until is not null and login_attempts.locked_until < now() then 1
    else login_attempts.failed_count + 1
  end`;
  const row = await queryOne<{ remaining_ms: number | null }>(
    `insert into login_attempts (email, failed_count, updated_at)
     values ($1, 1, now())
     on conflict (email) do update set
       failed_count = case
         when login_attempts.locked_until > now() then login_attempts.failed_count
         when (${nextCount}) >= $2 then 0
         else (${nextCount})
       end,
       locked_until = case
         when login_attempts.locked_until > now() then login_attempts.locked_until
         when (${nextCount}) >= $2 then now() + make_interval(secs => $3)
         else null
       end,
       updated_at = now()
     returning ceil(extract(epoch from (locked_until - now())) * 1000)::float8 as remaining_ms`,
    [email, MAX_ATTEMPTS, LOCKOUT_MS / 1000],
  );
  const remainingMs = row?.remaining_ms != null ? Math.max(0, row.remaining_ms) : 0;
  return { locked: remainingMs > 0, remainingMs };
}

export async function clearAttempts(email: string): Promise<void> {
  await execute(`delete from login_attempts where email = $1`, [email]);
}

export function lockoutMessage(remainingMs: number): string {
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return `Too many failed attempts. Account locked — try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}
