'use client';

import { useRouter } from 'next/navigation';
import { MonthPicker } from '@/components/month-picker';
import { NativeSelect } from '@/components/ui/native-select';
import { yearOptions } from '@/lib/format-date';

export function FinancialPeriodPicker({
  mode,
  month,
  year,
}: {
  mode: 'month' | 'year';
  month: string;
  year: string;
}) {
  const router = useRouter();

  return (
    <div className='flex items-center gap-2'>
      <NativeSelect
        aria-label='Report period'
        value={mode}
        onChange={(e) => {
          const nextMode = e.target.value as 'month' | 'year';
          router.push(
            nextMode === 'month'
              ? `/financial-report?mode=month&month=${month}`
              : `/financial-report?mode=year&year=${year}`,
          );
        }}
        className='w-auto'
      >
        <option value='month'>Month</option>
        <option value='year'>Year</option>
      </NativeSelect>

      {mode === 'month' ? (
        <MonthPicker value={month} basePath='/financial-report' />
      ) : (
        <NativeSelect
          aria-label='Year'
          value={year}
          onChange={(e) => router.push(`/financial-report?mode=year&year=${e.target.value}`)}
          className='w-auto'
        >
          {yearOptions().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </NativeSelect>
      )}
    </div>
  );
}
