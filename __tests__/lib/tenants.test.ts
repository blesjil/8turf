import { beforeEach, describe, expect, it, vi } from 'vitest';

// tenants.ts only orchestrates SQL; mock the db layer and assert the query
// shape (ownership scoping + bound params) rather than hitting Postgres.
const queryOne = vi.fn();
vi.mock('@/lib/db', () => ({
  queryOne: (...args: unknown[]) => queryOne(...args),
}));

import { findAuthorizedDocument, findAuthorizedTenant } from '@/lib/tenants';

beforeEach(() => {
  queryOne.mockReset();
});

describe('findAuthorizedTenant', () => {
  it('passes the tenant id and scope through as bound params', async () => {
    queryOne.mockResolvedValue({ id: 't1' });
    const result = await findAuthorizedTenant('t1', 'user-1');

    expect(result).toEqual({ id: 't1' });
    const [sql, params] = queryOne.mock.calls[0];
    expect(sql).toContain('FROM tenants t');
    expect(params).toEqual(['t1', 'user-1']);
  });

  it('scopes ownership with the ($2 IS NULL OR user_id = $2) guard', async () => {
    queryOne.mockResolvedValue(null);
    await findAuthorizedTenant('t1', null);

    const [sql, params] = queryOne.mock.calls[0];
    expect(sql).toContain('$2::text IS NULL OR p.user_id = $2');
    expect(params).toEqual(['t1', null]); // null scope ⇒ admin ⇒ no filter
  });

  it('returns null when no authorized tenant is found', async () => {
    queryOne.mockResolvedValue(null);
    expect(await findAuthorizedTenant('missing', 'user-1')).toBeNull();
  });
});

describe('findAuthorizedDocument', () => {
  it('joins through tenant→unit→property and scopes by owner', async () => {
    queryOne.mockResolvedValue({ id: 'd1', drive_file_id: 'gdrive-1' });
    const result = await findAuthorizedDocument('d1', 'user-1');

    expect(result).toEqual({ id: 'd1', drive_file_id: 'gdrive-1' });
    const [sql, params] = queryOne.mock.calls[0];
    expect(sql).toContain('FROM tenant_documents d');
    expect(sql).toContain('$2::text IS NULL OR p.user_id = $2');
    expect(params).toEqual(['d1', 'user-1']);
  });

  it('returns null when the document is not visible to the caller', async () => {
    queryOne.mockResolvedValue(null);
    expect(await findAuthorizedDocument('d1', 'other-user')).toBeNull();
  });
});
