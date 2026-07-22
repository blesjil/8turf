import { describe, expect, it } from 'vitest';
import { buildGroups } from '@/components/app-shell';

function navHrefs(isAdmin: boolean) {
  return buildGroups(isAdmin).flatMap((group) => group.items.map((item) => item.href));
}

describe('app shell navigation', () => {
  it('hides reports from non-admin users', () => {
    expect(navHrefs(false)).not.toContain('/reports');
  });

  it('shows reports to admins', () => {
    expect(navHrefs(true)).toContain('/reports');
  });

  it('financial report lives under reports, not as its own sidebar item', () => {
    expect(navHrefs(true)).not.toContain('/financial-report');
    const reportsItem = buildGroups(true)
      .flatMap((g) => g.items)
      .find((i) => i.href === '/reports');
    expect(reportsItem?.match).toContain('/financial-report');
  });

  it('shows maintenance contacts to every signed-in user', () => {
    expect(navHrefs(false)).toContain('/maintenance/contacts');
    expect(navHrefs(true)).toContain('/maintenance/contacts');
  });
});
