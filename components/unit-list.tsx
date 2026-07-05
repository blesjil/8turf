import Link from 'next/link';
import { formatCents } from '@/lib/money';

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
    return <p className='text-foreground/60'>No units yet. Add the first one.</p>;
  }

  return (
    <div className='grid gap-4 sm:grid-cols-2'>
      {units.map((unit) => (
        <Link
          key={unit.id}
          href={`/properties/${propertyId}/units/${unit.id}`}
          className='block p-4 border border-border rounded-lg hover:bg-foreground/5 transition-colors'
        >
          <h3 className='font-semibold mb-1'>{unit.unit_label}</h3>
          <p className='text-sm text-foreground/60 mb-1'>
            {unit.bedrooms} bd / {unit.bathrooms} ba &middot; {formatCents(unit.rentAmount)}/mo
          </p>
          <p className='text-sm text-foreground/40'>
            {unit.tenantName ? `Tenant: ${unit.tenantName}` : 'No tenant assigned'}
          </p>
        </Link>
      ))}
    </div>
  );
}
