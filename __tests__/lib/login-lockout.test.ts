import { beforeEach, describe, expect, it, vi } from 'vitest';

const { queryOne, execute } = vi.hoisted(() => ({
  queryOne: vi.fn(),
  execute: vi.fn(),
}));

vi.mock('@/lib/db', () => ({ queryOne, execute }));

import {
  LOCKOUT_MS,
  MAX_ATTEMPTS,
  clearAttempts,
  getLockRemainingMs,
  lockoutMessage,
  normalizeEmail,
  recordFailedAttempt,
} from '@/lib/login-lockout';

beforeEach(() => {
  queryOne.mockReset();
  execute.mockReset();
});

describe('normalizeEmail', () => {
  it('trims and lowercases', () => {
    expect(normalizeEmail('  Jill@Example.COM ')).toBe('jill@example.com');
  });

  it('returns null for non-strings', () => {
    expect(normalizeEmail(undefined)).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
    expect(normalizeEmail(42)).toBeNull();
  });

  it('returns null for empty/whitespace strings', () => {
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail('   ')).toBeNull();
  });
});

describe('getLockRemainingMs', () => {
  it('returns 0 when no active lock row exists', async () => {
    queryOne.mockResolvedValue(null);
    await expect(getLockRemainingMs('a@b.c')).resolves.toBe(0);
    expect(queryOne).toHaveBeenCalledWith(expect.stringContaining('locked_until > now()'), [
      'a@b.c',
    ]);
  });

  it('returns the remaining milliseconds of an active lock', async () => {
    queryOne.mockResolvedValue({ remaining_ms: 42_000 });
    await expect(getLockRemainingMs('a@b.c')).resolves.toBe(42_000);
  });

  it('never returns a negative value', async () => {
    queryOne.mockResolvedValue({ remaining_ms: -5 });
    await expect(getLockRemainingMs('a@b.c')).resolves.toBe(0);
  });
});

describe('recordFailedAttempt', () => {
  it('issues a single atomic upsert keyed by email', async () => {
    execute.mockResolvedValue(1);
    await recordFailedAttempt('a@b.c');
    expect(execute).toHaveBeenCalledTimes(1);
    const [sql, params] = execute.mock.calls[0];
    expect(sql).toMatch(/insert into login_attempts/);
    expect(sql).toMatch(/on conflict \(email\) do update/);
    expect(params).toEqual(['a@b.c', MAX_ATTEMPTS, LOCKOUT_MS / 1000]);
  });

  it('locks at MAX_ATTEMPTS and restarts the count after an expired lock', async () => {
    execute.mockResolvedValue(1);
    await recordFailedAttempt('a@b.c');
    const [sql] = execute.mock.calls[0];
    // lock is applied when the incremented count reaches the threshold
    expect(sql).toMatch(/>= \$2 then now\(\) \+ make_interval/);
    // an expired lock restarts the counter at 1 instead of incrementing
    expect(sql).toMatch(/locked_until < now\(\) then 1/);
  });
});

describe('clearAttempts', () => {
  it('deletes the row for the email', async () => {
    execute.mockResolvedValue(1);
    await clearAttempts('a@b.c');
    expect(execute).toHaveBeenCalledWith(expect.stringMatching(/delete from login_attempts/), [
      'a@b.c',
    ]);
  });
});

describe('lockoutMessage', () => {
  it('rounds remaining time up to whole minutes', () => {
    expect(lockoutMessage(61_000)).toContain('2 minutes');
    expect(lockoutMessage(LOCKOUT_MS)).toContain('60 minutes');
  });

  it('uses singular form and a 1-minute floor', () => {
    expect(lockoutMessage(30_000)).toContain('1 minute.');
    expect(lockoutMessage(0)).toContain('1 minute.');
  });
});
