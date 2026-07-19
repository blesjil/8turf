import { describe, expect, it } from 'vitest';
import { buildGroups } from '@/components/app-shell';

function navHrefs(isAdmin: boolean) {
  return buildGroups(isAdmin).flatMap((group) => group.items.map((item) => item.href));
}

describe('app shell navigation', () => {
  it('hides the financial report from non-admin users', () => {
    expect(navHrefs(false)).not.toContain('/financial-report');
  });

  it('shows the financial report to admins', () => {
    expect(navHrefs(true)).toContain('/financial-report');
  });
});
