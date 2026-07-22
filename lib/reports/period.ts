import { addMonths, format, parseISO } from 'date-fns';

// A month (YYYY-MM) as an inclusive-start / exclusive-end date range, so date
// filters use `field >= start AND field < endExclusive` and never double-count
// a boundary. See the reports design doc, section 5.
export function monthBounds(period: string): { start: string; endExclusive: string } {
  const start = `${period}-01`;
  const endExclusive = format(addMonths(parseISO(start), 1), 'yyyy-MM-dd');
  return { start, endExclusive };
}

// Every YYYY-MM period from `from` to `to` inclusive (both YYYY-MM). A single
// month yields one period; used to feed deriveCharges over a range.
export function periodsInRange(from: string, to: string): string[] {
  const periods: string[] = [];
  let cursor = parseISO(`${from}-01`);
  const end = parseISO(`${to}-01`);
  while (cursor <= end) {
    periods.push(format(cursor, 'yyyy-MM'));
    cursor = addMonths(cursor, 1);
  }
  return periods;
}
