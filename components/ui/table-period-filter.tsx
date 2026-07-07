'use client';

import { MONTH_NAMES } from '@/lib/format-date';
import { NativeSelect } from '@/components/ui/native-select';

export function TablePeriodFilter({
  years,
  year,
  month,
  onYearChange,
  onMonthChange,
}: {
  years: string[];
  year: string;
  month: string;
  onYearChange: (year: string) => void;
  onMonthChange: (month: string) => void;
}) {
  return (
    <div className='flex items-center gap-2'>
      <NativeSelect
        aria-label='Filter by year'
        value={year}
        onChange={(e) => onYearChange(e.target.value)}
        className='w-auto'
      >
        <option value=''>All years</option>
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </NativeSelect>
      <NativeSelect
        aria-label='Filter by month'
        value={month}
        onChange={(e) => onMonthChange(e.target.value)}
        className='w-auto'
      >
        <option value=''>All months</option>
        {MONTH_NAMES.map((name, i) => {
          const v = String(i + 1).padStart(2, '0');
          return (
            <option key={v} value={v}>
              {name}
            </option>
          );
        })}
      </NativeSelect>
    </div>
  );
}
