'use client';

import { useRouter } from 'next/navigation';
import { MONTH_NAMES, yearOptions } from '@/lib/format-date';
import { NativeSelect } from '@/components/ui/native-select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Month picker plus an optional as-of date, kept in the URL together so
// changing one never drops the other. Each report shows only the filters it
// needs (design doc section 4): month everywhere, as-of on balance reports.
export function ReportFilters({
  basePath,
  month,
  asOf,
  showAsOf = false,
}: {
  basePath: string;
  month: string;
  asOf?: string;
  showAsOf?: boolean;
}) {
  const router = useRouter();
  const [year, monthPart] = month.split('-');

  function navigate(nextMonth: string, nextAsOf?: string) {
    const params = new URLSearchParams({ month: nextMonth });
    if (showAsOf && nextAsOf) params.set('asOf', nextAsOf);
    router.push(`${basePath}?${params.toString()}`);
  }

  return (
    <div className='flex flex-wrap items-end gap-3'>
      <div className='flex flex-col gap-1'>
        <Label className='text-xs text-muted-foreground'>Month</Label>
        <div className='flex gap-2'>
          <NativeSelect
            aria-label='Month'
            value={monthPart}
            onChange={(e) => navigate(`${year}-${e.target.value}`, asOf)}
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
            onChange={(e) => navigate(`${e.target.value}-${monthPart}`, asOf)}
            className='w-auto'
          >
            {yearOptions().map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </NativeSelect>
        </div>
      </div>
      {showAsOf && (
        <div className='flex flex-col gap-1'>
          <Label htmlFor='asOf' className='text-xs text-muted-foreground'>
            As-of date
          </Label>
          <Input
            id='asOf'
            type='date'
            value={asOf ?? ''}
            onChange={(e) => navigate(month, e.target.value)}
            className='w-auto'
          />
        </div>
      )}
    </div>
  );
}
