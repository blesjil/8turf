import { describe, expect, it } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn', () => {
  it('joins plain class names', () => {
    expect(cn('a', 'b')).toBe('a b');
  });

  it('drops falsy values from conditional classes', () => {
    expect(cn('a', false && 'b', null, undefined, 'c')).toBe('a c');
  });

  it('merges conflicting tailwind utilities, last one wins', () => {
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('supports object and array inputs', () => {
    expect(cn(['a', { b: true, c: false }], 'd')).toBe('a b d');
  });

  it('returns an empty string with no arguments', () => {
    expect(cn()).toBe('');
  });
});
