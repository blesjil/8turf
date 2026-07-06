import Link from 'next/link';

export function PaymentsTabs({
  active,
  isAdmin,
}: {
  active: 'payments' | 'financial-report';
  isAdmin: boolean;
}) {
  const tabClass = (tab: 'payments' | 'financial-report') =>
    `px-4 py-2 border border-border rounded-lg hover:bg-foreground/5 ${
      active === tab ? 'bg-foreground/5 font-medium' : ''
    }`;

  return (
    <div className='flex gap-3 mb-6'>
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
