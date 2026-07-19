import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Capture the config passed to betterAuth so the sign-in lockout hooks can be
// invoked directly. createAuthMiddleware is stubbed to the identity function so
// the hook body is the callable we test. registerAttempt/clearAttempts are
// spied; normalizeEmail/lockoutMessage stay real.
const { registerAttempt, clearAttempts, FakeAPIError } = vi.hoisted(() => {
  class FakeAPIError extends Error {
    constructor(
      public code: string,
      public opts: { message: string },
    ) {
      super(opts.message);
    }
  }
  return { registerAttempt: vi.fn(), clearAttempts: vi.fn(), FakeAPIError };
});

vi.mock('better-auth', () => ({ betterAuth: (config: unknown) => config }));
vi.mock('better-auth/api', () => ({
  APIError: FakeAPIError,
  createAuthMiddleware: (fn: unknown) => fn,
}));
vi.mock('better-auth/next-js', () => ({ nextCookies: () => ({ id: 'next-cookies' }) }));
vi.mock('better-auth/plugins', () => ({ admin: (opts: unknown) => ({ id: 'admin', opts }) }));
vi.mock('@/lib/db', () => ({ pool: { fake: 'pool' } }));
vi.mock('@/lib/login-lockout', async () => {
  const actual = await vi.importActual<typeof import('@/lib/login-lockout')>('@/lib/login-lockout');
  return { ...actual, registerAttempt, clearAttempts };
});

import { auth } from '@/lib/auth';

// betterAuth is the identity mock, so `auth` is the raw config object.
const config = auth as unknown as {
  hooks: { before: (ctx: unknown) => Promise<void>; after: (ctx: unknown) => Promise<void> };
  emailAndPassword: { disableSignUp: boolean };
  session: { expiresIn: number };
};

beforeEach(() => {
  registerAttempt.mockReset();
  clearAttempts.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('auth config', () => {
  it('disables self sign-up and uses a 10-minute idle session', () => {
    expect(config.emailAndPassword.disableSignUp).toBe(true);
    expect(config.session.expiresIn).toBe(600);
  });
});

describe('before hook (lockout gate)', () => {
  it('ignores paths other than /sign-in/email', async () => {
    await config.hooks.before({ path: '/sign-up/email', body: { email: 'a@b.com' } });
    expect(registerAttempt).not.toHaveBeenCalled();
  });

  it('ignores requests with no usable email', async () => {
    await config.hooks.before({ path: '/sign-in/email', body: {} });
    expect(registerAttempt).not.toHaveBeenCalled();
  });

  it('registers the attempt with the normalized email and allows unlocked accounts', async () => {
    registerAttempt.mockResolvedValue({ locked: false, remainingMs: 0 });
    await expect(
      config.hooks.before({ path: '/sign-in/email', body: { email: '  A@B.COM ' } }),
    ).resolves.toBeUndefined();
    expect(registerAttempt).toHaveBeenCalledWith('a@b.com');
  });

  it('throws a rate-limit error once the account is locked', async () => {
    registerAttempt.mockResolvedValue({ locked: true, remainingMs: 120000 });
    await expect(
      config.hooks.before({ path: '/sign-in/email', body: { email: 'a@b.com' } }),
    ).rejects.toBeInstanceOf(FakeAPIError);
    await expect(
      config.hooks.before({ path: '/sign-in/email', body: { email: 'a@b.com' } }),
    ).rejects.toThrow(/locked/);
  });
});

describe('after hook (clear on success)', () => {
  it('ignores non sign-in paths', async () => {
    await config.hooks.after({ path: '/other', body: { email: 'a@b.com' }, context: {} });
    expect(clearAttempts).not.toHaveBeenCalled();
  });

  it('clears attempts after a successful sign-in', async () => {
    await config.hooks.after({
      path: '/sign-in/email',
      body: { email: 'A@b.com' },
      context: { returned: { ok: true } },
    });
    expect(clearAttempts).toHaveBeenCalledWith('a@b.com');
  });

  it('ignores a sign-in with no usable email', async () => {
    await config.hooks.after({ path: '/sign-in/email', body: {}, context: { returned: {} } });
    expect(clearAttempts).not.toHaveBeenCalled();
  });

  it('leaves attempts intact when sign-in returned an APIError', async () => {
    await config.hooks.after({
      path: '/sign-in/email',
      body: { email: 'a@b.com' },
      context: { returned: new FakeAPIError('UNAUTHORIZED', { message: 'bad creds' }) },
    });
    expect(clearAttempts).not.toHaveBeenCalled();
  });
});
