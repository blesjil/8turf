import { describe, expect, it } from 'vitest';
import { PAGE_SIZE, clampPage, paginate } from '@/components/ui/pagination';

describe('pagination', () => {
  const records = Array.from({ length: 45 }, (_, index) => index + 1);

  it('displays 20 records on each full page', () => {
    expect(PAGE_SIZE).toBe(20);
    expect(paginate(records, 1)).toEqual(records.slice(0, 20));
    expect(paginate(records, 2)).toEqual(records.slice(20, 40));
  });

  it('returns the remaining records on the final page', () => {
    expect(paginate(records, 3)).toEqual(records.slice(40));
  });

  it('keeps requested pages within the available range', () => {
    expect(clampPage(undefined, 3)).toBe(1);
    expect(clampPage('0', 3)).toBe(1);
    expect(clampPage('99', 3)).toBe(3);
  });
});
