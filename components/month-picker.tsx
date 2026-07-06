'use client';

import { useRouter } from 'next/navigation';
import { MONTH_NAMES, yearOptions } from '@/lib/format-date';
import { NativeSelect } from '@/components/ui/native-select';

export function MonthPicker({
  value,
  basePath = '/payments',
}: {
  value: string;
  basePath?: string;
}) {
  const router = useRouter();
  const [year, month] = value.split('-');

  function navigate(nextYear: string, nextMonth: string) {
    router.push(`${basePath}?month=${nextYear}-${nextMonth}`);
  }

  return (
    <div className='flex gap-2'>
      <NativeSelect
        aria-label='Month'
        value={month}
        onChange={(e) => navigate(year, e.target.value)}
        className='w-auto'
      >
        {MONTH_NAMES.map((name, i) => {
          const value = String(i + 1).padStart(2, '0');
          return (
            <option key={value} value={value}>
              {name}
            </option>
          );
        })}
      </NativeSelect>
      <NativeSelect
        aria-label='Year'
        value={year}
        onChange={(e) => navigate(e.target.value, month)}
        className='w-auto'
      >
        {yearOptions().map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </NativeSelect>
    </div>
  );
}
