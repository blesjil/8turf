import { describe, it, expect } from 'vitest';
import { generateTempPassword } from '@/lib/generate-password';

describe('generateTempPassword', () => {
  it('defaults to a 20-character password', () => {
    expect(generateTempPassword()).toHaveLength(20);
  });

  it('respects a custom length', () => {
    expect(generateTempPassword(32)).toHaveLength(32);
  });

  it('only uses characters from the expected charset', () => {
    const password = generateTempPassword(200);
    expect(password).toMatch(/^[A-Za-z0-9!@#$%^&*]+$/);
  });

  it('generates different passwords on each call', () => {
    const a = generateTempPassword();
    const b = generateTempPassword();
    expect(a).not.toBe(b);
  });
});
