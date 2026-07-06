'use client';

import { useRouter } from 'next/navigation';

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function yearOptions(): number[] {
  const currentYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = currentYear + 1; y >= currentYear - 5; y--) years.push(y);
  return years;
}

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
      <select
        value={month}
        onChange={(e) => navigate(year, e.target.value)}
        className='px-3 py-2 border border-border rounded-lg'
      >
        {MONTH_NAMES.map((name, i) => {
          const value = String(i + 1).padStart(2, '0');
          return (
            <option key={value} value={value}>
              {name}
            </option>
          );
        })}
      </select>
      <select
        value={year}
        onChange={(e) => navigate(e.target.value, month)}
        className='px-3 py-2 border border-border rounded-lg'
      >
        {yearOptions().map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </select>
    </div>
  );
}
