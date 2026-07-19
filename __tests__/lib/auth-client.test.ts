import { describe, expect, it, vi } from 'vitest';

// Smoke test: the client module only wires better-auth/react with the admin
// plugin and re-exports helpers. Mock the SDK and assert the wiring + exports.
const { createAuthClient } = vi.hoisted(() => ({
  createAuthClient: vi.fn(() => ({
    signIn: 'signIn',
    signOut: 'signOut',
    useSession: 'useSession',
  })),
}));
vi.mock('better-auth/react', () => ({ createAuthClient }));
vi.mock('better-auth/client/plugins', () => ({ adminClient: () => ({ id: 'admin-client' }) }));

import { authClient, signIn, signOut, useSession } from '@/lib/auth-client';

describe('auth-client', () => {
  it('creates the client with the admin plugin', () => {
    expect(createAuthClient).toHaveBeenCalledTimes(1);
    const config = (createAuthClient.mock.calls[0] as unknown[])[0] as {
      plugins: { id: string }[];
    };
    expect(config.plugins).toEqual([{ id: 'admin-client' }]);
  });

  it('re-exports the client helpers', () => {
    expect(authClient).toBeDefined();
    expect(signIn).toBe('signIn');
    expect(signOut).toBe('signOut');
    expect(useSession).toBe('useSession');
  });
});
