'use client';

import { useRouter } from 'next/navigation';
import { MonthPicker } from '@/components/month-picker';

function yearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear + 1; y >= currentYear - 5; y--) years.push(y);
  return years;
}

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
    <div className='flex items-center gap-3'>
      <select
        value={mode}
        onChange={(e) => {
          const nextMode = e.target.value as 'month' | 'year';
          router.push(
            nextMode === 'month'
              ? `/financial-report?mode=month&month=${month}`
              : `/financial-report?mode=year&year=${year}`,
          );
        }}
        className='px-3 py-2 border border-border rounded-lg'
      >
        <option value='month'>Month</option>
        <option value='year'>Year</option>
      </select>

      {mode === 'month' ? (
        <MonthPicker value={month} basePath='/financial-report' />
      ) : (
        <select
          value={year}
          onChange={(e) => router.push(`/financial-report?mode=year&year=${e.target.value}`)}
          className='px-3 py-2 border border-border rounded-lg'
        >
          {yearOptions().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}
