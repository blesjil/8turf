'use client';

import { useState } from 'react';
import { MONTH_NAMES, yearOptions, formatPeriod } from '@/lib/format-date';
import { Button } from '@/components/ui/button';
import { NativeSelect } from '@/components/ui/native-select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function MonthPickerField({
  name,
  defaultValue,
  required,
  className,
}: {
  name: string;
  defaultValue?: string;
  required?: boolean;
  className?: string;
}) {
  const [defaultYear, defaultMonth] = (defaultValue ?? '').split('-');
  const [year, setYear] = useState(defaultYear ?? '');
  const [month, setMonth] = useState(defaultMonth ?? '');
  const [open, setOpen] = useState(false);
  const value = year && month ? `${year}-${month}` : '';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <input type='hidden' name={name} value={value} required={required} />
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            className={cn(
              'w-full justify-start font-normal',
              !value && 'text-muted-foreground',
              className,
            )}
          />
        }
      >
        {value ? formatPeriod(value) : 'Select month'}
      </PopoverTrigger>
      <PopoverContent className='flex w-auto gap-2 p-2'>
        <NativeSelect
          aria-label='Month'
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className='w-auto'
        >
          <option value='' disabled>
            Month
          </option>
          {MONTH_NAMES.map((name, i) => {
            const v = String(i + 1).padStart(2, '0');
            return (
              <option key={v} value={v}>
                {name}
              </option>
            );
          })}
        </NativeSelect>
        <NativeSelect
          aria-label='Year'
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className='w-auto'
        >
          <option value='' disabled>
            Year
          </option>
          {yearOptions().map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </NativeSelect>
      </PopoverContent>
    </Popover>
  );
}
