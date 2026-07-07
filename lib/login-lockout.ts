import { execute, queryOne } from './db';

export const MAX_ATTEMPTS = 3;
export const LOCKOUT_MS = 60 * 60 * 1000;

export function normalizeEmail(email: unknown): string | null {
  if (typeof email !== 'string') return null;
  const normalized = email.trim().toLowerCase();
  return normalized || null;
}

// Remaining lock time in ms, 0 when not locked. Expired locks count as unlocked.
export async function getLockRemainingMs(email: string): Promise<number> {
  const row = await queryOne<{ remaining_ms: number }>(
    `select ceil(extract(epoch from (locked_until - now())) * 1000)::float8 as remaining_ms
       from login_attempts
      where email = $1 and locked_until > now()`,
    [email],
  );
  return row ? Math.max(0, row.remaining_ms) : 0;
}

// Atomic increment: a failure after an expired lock restarts the count at 1;
// reaching MAX_ATTEMPTS sets locked_until and resets the counter.
export async function recordFailedAttempt(email: string): Promise<void> {
  // "next count" = 1 if the previous lock expired, otherwise failed_count + 1
  const nextCount = `case
    when login_attempts.locked_until is not null and login_attempts.locked_until < now() then 1
    else login_attempts.failed_count + 1
  end`;
  await execute(
    `insert into login_attempts (email, failed_count, updated_at)
     values ($1, 1, now())
     on conflict (email) do update set
       failed_count = case when (${nextCount}) >= $2 then 0 else (${nextCount}) end,
       locked_until = case when (${nextCount}) >= $2 then now() + make_interval(secs => $3) else null end,
       updated_at = now()`,
    [email, MAX_ATTEMPTS, LOCKOUT_MS / 1000],
  );
}

export async function clearAttempts(email: string): Promise<void> {
  await execute(`delete from login_attempts where email = $1`, [email]);
}

export function lockoutMessage(remainingMs: number): string {
  const minutes = Math.max(1, Math.ceil(remainingMs / 60_000));
  return `Too many failed attempts. Account locked — try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}
