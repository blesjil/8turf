'use client';

import { useRouter } from 'next/navigation';

export function MonthPicker({ value }: { value: string }) {
  const router = useRouter();

  return (
    <input
      type='month'
      value={value}
      onChange={(e) => router.push(`/payments?month=${e.target.value}`)}
      className='px-3 py-2 border border-border rounded-lg'
    />
  );
}
