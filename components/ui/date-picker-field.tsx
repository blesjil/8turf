'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';

function parseIsoDate(iso?: string): Date | undefined {
  if (!iso) return undefined;
  const d = parseISO(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export function DatePickerField({
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
  const [selected, setSelected] = useState<Date | undefined>(() => parseIsoDate(defaultValue));
  const [open, setOpen] = useState(false);
  const iso = selected ? format(selected, 'yyyy-MM-dd') : '';

  const currentYear = new Date().getFullYear();
  const startMonth = new Date(currentYear - 5, 0);
  const endMonth = new Date(currentYear + 5, 11);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <input type='hidden' name={name} value={iso} required={required} />
      <PopoverTrigger
        render={
          <Button
            type='button'
            variant='outline'
            className={cn(
              'w-full justify-start font-normal',
              !selected && 'text-muted-foreground',
              className,
            )}
          />
        }
      >
        {selected ? format(selected, 'MMMM d, yyyy') : 'Select date'}
      </PopoverTrigger>
      <PopoverContent className='w-auto p-0'>
        <Calendar
          mode='single'
          captionLayout='dropdown'
          startMonth={startMonth}
          endMonth={endMonth}
          selected={selected}
          defaultMonth={selected}
          onSelect={(d) => {
            setSelected(d);
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
