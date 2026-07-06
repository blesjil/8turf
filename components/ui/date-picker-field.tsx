'use client';

import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/style.css';
import { format, parseISO } from 'date-fns';

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

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <input type='hidden' name={name} value={iso} required={required} />
      <Popover.Trigger
        type='button'
        className={
          className ??
          'px-3 py-2 border border-border rounded-lg bg-background text-foreground text-left w-full cursor-pointer'
        }
      >
        {selected ? format(selected, 'MMMM d, yyyy') : 'Select date'}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={4}
          className='z-50 rounded-lg border border-border bg-background p-2 shadow-lg'
        >
          <DayPicker
            mode='single'
            selected={selected}
            defaultMonth={selected}
            onSelect={(d) => {
              setSelected(d);
              setOpen(false);
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
