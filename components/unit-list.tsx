import Link from 'next/link';
import { formatCents } from '@/lib/money';
import { Badge } from '@/components/ui/badge';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface UnitListItem {
  id: string;
  unit_label: string;
  bedrooms: number;
  bathrooms: number;
  rentAmount: number;
  tenantName: string | null;
}

export function UnitList({ propertyId, units }: { propertyId: string; units: UnitListItem[] }) {
  if (units.length === 0) {
    return (
      <Card className='py-8 text-center'>
        <CardHeader className='items-center'>
          <CardTitle>No units yet</CardTitle>
          <CardDescription>Add the first unit to this property.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className='grid gap-4 sm:grid-cols-2'>
      {units.map((unit) => (
        <Link key={unit.id} href={`/properties/${propertyId}/units/${unit.id}`} className='group'>
          <Card className='h-full transition-colors group-hover:border-primary/40'>
            <CardHeader>
              <div className='flex items-start justify-between gap-2'>
                <CardTitle className='font-mono group-hover:text-primary'>
                  {unit.unit_label}
                </CardTitle>
                {unit.tenantName ? (
                  <Badge variant='secondary' className='shrink-0'>
                    Occupied
                  </Badge>
                ) : (
                  <Badge variant='outline' className='shrink-0 text-muted-foreground'>
                    Vacant
                  </Badge>
                )}
              </div>
              <CardDescription>
                {unit.bedrooms} bd / {unit.bathrooms} ba ·{' '}
                <span className='font-mono'>{formatCents(unit.rentAmount)}</span>/mo
              </CardDescription>
              <CardDescription>
                {unit.tenantName ? unit.tenantName : 'No tenant assigned'}
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
