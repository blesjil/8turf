import { formatDate, formatPeriod } from '@/lib/format-date';

// Every report page (and, later, every export) shows its date basis, so the
// number a row is grouped by is never ambiguous. See the reports design doc,
// sections 2 and 8.
export function ReportHeader({
  title,
  period,
  dateBasis,
  asOf,
  action,
}: {
  title: string;
  period?: string;
  dateBasis: string;
  asOf?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className='mb-6 flex flex-wrap items-start justify-between gap-3'>
      <div className='flex flex-col gap-1.5'>
        <h1 className='font-heading text-2xl font-semibold tracking-tight'>{title}</h1>
        <div className='flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground'>
          {period && (
            <span>
              Period: <span className='text-foreground'>{formatPeriod(period)}</span>
            </span>
          )}
          <span>
            Date basis: <span className='text-foreground'>{dateBasis}</span>
          </span>
          {asOf && (
            <span>
              As of: <span className='text-foreground'>{formatDate(asOf)}</span>
            </span>
          )}
        </div>
      </div>
      {action && <div className='flex items-center gap-2'>{action}</div>}
    </div>
  );
}
