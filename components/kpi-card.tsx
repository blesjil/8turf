import type { ReactNode } from 'react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

const TONES = {
  green: 'bg-success-muted text-primary',
  blue: 'bg-info-muted text-info',
  amber: 'bg-warning-muted text-warning',
  red: 'bg-danger-muted text-destructive',
} as const;

export function KpiCard({
  label,
  value,
  foot,
  icon,
  tone = 'green',
}: {
  label: string;
  value: string;
  foot?: ReactNode;
  icon: ReactNode;
  tone?: keyof typeof TONES;
}) {
  return (
    <Card className='gap-2.5 px-4.5'>
      <div className='flex items-center justify-between'>
        <span className='text-[12.5px] font-semibold text-muted-foreground'>{label}</span>
        <span
          className={cn('grid size-8 place-items-center rounded-lg [&_svg]:size-4', TONES[tone])}
          aria-hidden
        >
          {icon}
        </span>
      </div>
      <div className='font-heading text-[28px] leading-none font-semibold tabular-nums'>
        {value}
      </div>
      {foot && <div className='text-[12.5px] text-muted-foreground'>{foot}</div>}
    </Card>
  );
}
