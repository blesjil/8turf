import { describe, expect, it } from 'vitest';
import { isAdmin, ownerScope } from '@/lib/access';

describe('ownerScope', () => {
  it('returns null for admins so queries skip the ownership filter', () => {
    expect(ownerScope({ user: { id: 'u1', role: 'admin' } })).toBeNull();
  });

  it('returns the user id for regular users', () => {
    expect(ownerScope({ user: { id: 'u1', role: 'user' } })).toBe('u1');
  });

  it('returns the user id when role is missing', () => {
    expect(ownerScope({ user: { id: 'u1' } })).toBe('u1');
    expect(ownerScope({ user: { id: 'u1', role: null } })).toBe('u1');
  });
});

describe('isAdmin', () => {
  it('detects the admin role', () => {
    expect(isAdmin({ user: { id: 'u1', role: 'admin' } })).toBe(true);
    expect(isAdmin({ user: { id: 'u1', role: 'user' } })).toBe(false);
    expect(isAdmin({ user: { id: 'u1' } })).toBe(false);
  });
});
