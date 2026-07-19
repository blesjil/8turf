'use client';

import { useRouter } from 'next/navigation';
import { STATUS_FILTERS, type StatusFilter } from '@/lib/payments-summary';
import { NativeSelect } from '@/components/ui/native-select';

const LABELS: Record<StatusFilter, string> = {
  all: 'All statuses',
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
  inactive: 'Inactive',
};

export function PaymentStatusFilter({
  period,
  value,
  basePath = '/payments',
}: {
  period: string;
  value: StatusFilter;
  basePath?: string;
}) {
  const router = useRouter();

  function navigate(next: string) {
    // Drop the page param so the filtered view starts on page 1.
    const params = new URLSearchParams({ month: period });
    if (next !== 'all') params.set('status', next);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <NativeSelect
      aria-label='Status'
      value={value}
      onChange={(e) => navigate(e.target.value)}
      className='w-auto'
    >
      {STATUS_FILTERS.map((status) => (
        <option key={status} value={status}>
          {LABELS[status]}
        </option>
      ))}
    </NativeSelect>
  );
}
