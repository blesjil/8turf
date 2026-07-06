import Link from 'next/link';
import { cn } from '@/lib/utils';

export function PaymentsTabs({
  active,
  isAdmin,
}: {
  active: 'payments' | 'financial-report';
  isAdmin: boolean;
}) {
  const tabClass = (tab: 'payments' | 'financial-report') =>
    cn(
      'relative rounded-md px-3 py-1.5 text-sm font-medium transition-colors',
      active === tab
        ? 'text-foreground after:absolute after:inset-x-3 after:-bottom-[7px] after:h-0.5 after:rounded-full after:bg-primary'
        : 'text-muted-foreground hover:text-foreground',
    );

  return (
    <div className='mb-6 flex gap-1 border-b border-border pb-1.5'>
      <Link href='/payments' className={tabClass('payments')}>
        Payments Overview
      </Link>
      {isAdmin && (
        <Link href='/financial-report' className={tabClass('financial-report')}>
          Financial Report
        </Link>
      )}
    </div>
  );
}
