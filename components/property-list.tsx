import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCentsCompact } from '@/lib/money';

export interface PropertyListItem {
  id: string;
  name: string;
  address: string;
  unitCount: number;
  ownerName?: string | null;
  /** Rent collected this month, integer cents. */
  collected: number;
  /** Units with an active lease this month. */
  occupied: number;
  /** Occupied units that are unpaid / partially paid this month. */
  unpaidUnits: number;
  partialUnits: number;
}

// Deterministic identity gradient for the thumbnail — keeps the card visually
// distinct per property without carrying meaning (status lives in the pill).
const THUMBS = [
  'linear-gradient(135deg, #1f7a52, #155c3c)',
  'linear-gradient(135deg, #2563a8, #1b4d84)',
  'linear-gradient(135deg, #3a7d63, #245845)',
  'linear-gradient(135deg, #b4791e, #8a5c12)',
] as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  const chars = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : name.slice(0, 2);
  return chars.toUpperCase();
}

function thumbFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h + ch.charCodeAt(0)) % THUMBS.length;
  return THUMBS[h];
}

function statusFor(p: PropertyListItem): {
  variant: 'success' | 'warning' | 'destructive';
  label: string;
} {
  if (p.unpaidUnits > 0) return { variant: 'destructive', label: `${p.unpaidUnits} unpaid` };
  if (p.partialUnits > 0) return { variant: 'warning', label: `${p.partialUnits} partial` };
  return { variant: 'success', label: 'On track' };
}

function occupancyTone(pct: number): string {
  if (pct >= 90) return 'bg-primary';
  if (pct >= 70) return 'bg-warning';
  return 'bg-destructive';
}

export function PropertyList({ properties }: { properties: PropertyListItem[] }) {
  if (properties.length === 0) {
    return (
      <Card className='py-12 text-center'>
        <CardHeader className='justify-items-center'>
          <CardTitle>No properties yet</CardTitle>
          <CardDescription>Add your first property to start tracking rent.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
      {properties.map((property) => {
        const status = statusFor(property);
        const pct =
          property.unitCount > 0 ? Math.round((property.occupied / property.unitCount) * 100) : 0;
        return (
          <Link key={property.id} href={`/properties/${property.id}`} className='group'>
            <Card className='h-full gap-3.5 px-4 transition-all group-hover:-translate-y-0.5 group-hover:border-primary/30'>
              <div className='flex items-center gap-3'>
                <span
                  className='grid size-11 shrink-0 place-items-center rounded-xl font-heading text-sm font-bold text-white'
                  style={{ background: thumbFor(property.id) }}
                  aria-hidden
                >
                  {initials(property.name)}
                </span>
                <div className='min-w-0'>
                  <div className='truncate font-heading text-[15.5px] font-semibold group-hover:text-primary'>
                    {property.name}
                  </div>
                  <div className='truncate text-[12.5px] text-muted-foreground'>
                    {property.address}
                  </div>
                </div>
                <Badge variant={status.variant} className='ml-auto shrink-0'>
                  {status.label}
                </Badge>
              </div>

              <div className='flex gap-2.5'>
                <div className='flex-1'>
                  <div className='text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase'>
                    Collected
                  </div>
                  <div className='mt-0.5 font-heading text-[18px] font-semibold tabular-nums'>
                    {formatCentsCompact(property.collected)}
                  </div>
                </div>
                <div className='flex-1'>
                  <div className='text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase'>
                    Units
                  </div>
                  <div className='mt-0.5 font-heading text-[18px] font-semibold tabular-nums'>
                    {property.unitCount}
                  </div>
                </div>
              </div>

              <div>
                <div className='mb-1.5 flex justify-between text-[12px] text-muted-foreground'>
                  <span>Occupancy</span>
                  <span className='tabular-nums'>{pct}%</span>
                </div>
                <div className='h-1.5 overflow-hidden rounded-full bg-muted'>
                  <span
                    className={`block h-full rounded-full ${occupancyTone(pct)}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {property.ownerName && (
                <Badge variant='outline' className='w-fit'>
                  {property.ownerName}
                </Badge>
              )}
            </Card>
          </Link>
        );
      })}
    </div>
  );
}
