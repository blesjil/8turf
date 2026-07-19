import { Card } from '@/components/ui/card';

export interface HealthCounts {
  paid: number;
  partial: number;
  unpaid: number;
  vacant: number;
}

// Segment colours track the T3 status semantics: paid=green, partial=amber,
// unpaid=red, vacant=neutral grey.
const SEGMENTS = [
  { key: 'paid', label: 'paid', color: 'var(--primary)' },
  { key: 'partial', label: 'partial', color: 'var(--warning)' },
  { key: 'unpaid', label: 'unpaid', color: 'var(--destructive)' },
  { key: 'vacant', label: 'vacant', color: '#d0d5cf' },
] as const;

export function HealthStrip({ counts }: { counts: HealthCounts }) {
  const total = counts.paid + counts.partial + counts.unpaid + counts.vacant;
  const filled = SEGMENTS.filter((s) => counts[s.key] > 0);
  const summary = SEGMENTS.map((s) => `${counts[s.key]} ${s.label}`).join(', ');

  return (
    <Card className='flex-row flex-wrap items-center gap-4 px-5'>
      <div className='flex min-w-[150px] flex-col gap-0.5'>
        <span className='text-xs font-semibold tracking-wide text-muted-foreground uppercase'>
          Collection health
        </span>
        <span className='font-heading text-xl font-semibold'>{total} units</span>
      </div>

      <div
        className='flex h-6 min-w-[220px] flex-1 gap-0.5 overflow-hidden rounded-lg'
        role='img'
        aria-label={summary}
      >
        {filled.length === 0 ? (
          <span className='flex-1' style={{ background: '#d0d5cf' }} />
        ) : (
          filled.map((s) => (
            <span key={s.key} style={{ flex: counts[s.key], background: s.color }} />
          ))
        )}
      </div>

      <div className='flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted-foreground'>
        {SEGMENTS.map((s) => (
          <span key={s.key} className='inline-flex items-center gap-1.5'>
            <span className='size-2.5 rounded-[3px]' style={{ background: s.color }} />
            {counts[s.key]} {s.label}
          </span>
        ))}
      </div>
    </Card>
  );
}
