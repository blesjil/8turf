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
  lockoutMessage,
  normalizeEmail,
  registerAttempt,
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

describe('registerAttempt', () => {
  it('issues a single atomic upsert keyed by email and reports unlocked when below threshold', async () => {
    queryOne.mockResolvedValue({ remaining_ms: null });
    await expect(registerAttempt('a@b.c')).resolves.toEqual({ locked: false, remainingMs: 0 });
    expect(queryOne).toHaveBeenCalledTimes(1);
    const [sql, params] = queryOne.mock.calls[0];
    expect(sql).toMatch(/insert into login_attempts/);
    expect(sql).toMatch(/on conflict \(email\) do update/);
    expect(params).toEqual(['a@b.c', MAX_ATTEMPTS, LOCKOUT_MS / 1000]);
  });

  it('reports locked with remaining time once the threshold is reached', async () => {
    queryOne.mockResolvedValue({ remaining_ms: 42_000 });
    await expect(registerAttempt('a@b.c')).resolves.toEqual({
      locked: true,
      remainingMs: 42_000,
    });
  });

  it('never returns a negative remaining time', async () => {
    queryOne.mockResolvedValue({ remaining_ms: -5 });
    await expect(registerAttempt('a@b.c')).resolves.toEqual({ locked: false, remainingMs: 0 });
  });

  it('locks at MAX_ATTEMPTS, restarts the count after an expired lock, and leaves an active lock untouched', async () => {
    queryOne.mockResolvedValue({ remaining_ms: null });
    await registerAttempt('a@b.c');
    const [sql] = queryOne.mock.calls[0];
    // lock is applied when the incremented count reaches the threshold
    expect(sql).toMatch(/>= \$2 then now\(\) \+ make_interval/);
    // an expired lock restarts the counter at 1 instead of incrementing
    expect(sql).toMatch(/locked_until < now\(\) then 1/);
    // a row already under an active lock is left untouched (no re-increment)
    expect(sql).toMatch(/login_attempts\.locked_until > now\(\) then login_attempts\.failed_count/);
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
