'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const TABS = [
  { href: '/reports', label: 'Dashboard' },
  { href: '/reports/billing', label: 'Billing' },
  { href: '/reports/collections', label: 'Collections' },
  { href: '/reports/outstanding', label: 'Outstanding' },
  { href: '/reports/tenant-ledger', label: 'Tenant Ledger' },
  { href: '/reports/occupancy', label: 'Occupancy' },
];

export function ReportsNav() {
  const pathname = usePathname();
  return (
    <div className='mb-6 flex gap-1 overflow-x-auto border-b border-border pb-1.5'>
      {TABS.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'relative rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors',
              active
                ? 'text-foreground after:absolute after:inset-x-3 after:-bottom-[7px] after:h-0.5 after:rounded-full after:bg-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
