'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { MONTH_NAMES, yearOptions, formatPeriod } from '@/lib/format-date';

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
    <Popover.Root open={open} onOpenChange={setOpen}>
      <input type='hidden' name={name} value={value} required={required} />
      <Popover.Trigger
        type='button'
        className={
          className ??
          'px-3 py-2 border border-border rounded-lg bg-background text-foreground text-left w-full cursor-pointer'
        }
      >
        {value ? formatPeriod(value) : 'Select month'}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          className='z-50 flex gap-2 rounded-lg border border-border bg-background p-2 shadow-lg'
        >
          <select
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className='px-2 py-1 border border-border rounded-lg bg-background text-foreground'
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
          </select>
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className='px-2 py-1 border border-border rounded-lg bg-background text-foreground'
          >
            <option value='' disabled>
              Year
            </option>
            {yearOptions().map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
