import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock pg so the Pool is a spy and no real connection is opened. db.ts is thin
// glue over pool.query — verify row/rowCount mapping and default params.
const { poolQuery, setTypeParser } = vi.hoisted(() => ({
  poolQuery: vi.fn(),
  setTypeParser: vi.fn(),
}));
vi.mock('pg', () => ({
  Pool: vi.fn(function (this: { query: unknown }) {
    this.query = poolQuery;
  }),
  types: { setTypeParser, builtins: { TIMESTAMPTZ: 1184, TIMESTAMP: 1114, DATE: 1082 } },
}));

import { execute, query, queryOne } from '@/lib/db';

beforeEach(() => {
  poolQuery.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('query', () => {
  it('returns the result rows', async () => {
    poolQuery.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] });
    expect(await query('select 1')).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('defaults params to an empty array', async () => {
    poolQuery.mockResolvedValue({ rows: [] });
    await query('select 1');
    expect(poolQuery).toHaveBeenCalledWith('select 1', []);
  });

  it('forwards bound params', async () => {
    poolQuery.mockResolvedValue({ rows: [] });
    await query('select $1', ['a']);
    expect(poolQuery).toHaveBeenCalledWith('select $1', ['a']);
  });
});

describe('queryOne', () => {
  it('returns the first row', async () => {
    poolQuery.mockResolvedValue({ rows: [{ id: 1 }, { id: 2 }] });
    expect(await queryOne('select 1')).toEqual({ id: 1 });
  });

  it('returns null when no rows match', async () => {
    poolQuery.mockResolvedValue({ rows: [] });
    expect(await queryOne('select 1')).toBeNull();
  });
});

describe('execute', () => {
  it('returns the affected-row count', async () => {
    poolQuery.mockResolvedValue({ rowCount: 3 });
    expect(await execute('update t set x = 1')).toBe(3);
  });

  it('returns 0 when rowCount is null', async () => {
    poolQuery.mockResolvedValue({ rowCount: null });
    expect(await execute('update t set x = 1')).toBe(0);
  });
});

describe('type parsers', () => {
  it('registers date/timestamp parsers so columns come back as strings', () => {
    expect(setTypeParser).toHaveBeenCalled();
    // All three temporal OIDs get a passthrough parser.
    const oids = setTypeParser.mock.calls.map((c) => c[0]);
    expect(oids).toEqual(expect.arrayContaining([1184, 1114, 1082]));
    const parser = setTypeParser.mock.calls[0][1] as (v: string) => string;
    expect(parser('2026-07-19')).toBe('2026-07-19');
  });
});
