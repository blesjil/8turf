import Link from 'next/link';

export interface PropertyListItem {
  id: string;
  name: string;
  address: string;
  unitCount: number;
}

export function PropertyList({ properties }: { properties: PropertyListItem[] }) {
  if (properties.length === 0) {
    return (
      <p className='text-foreground/60'>No properties yet. Create your first one to get started.</p>
    );
  }

  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
      {properties.map((property) => (
        <Link
          key={property.id}
          href={`/properties/${property.id}`}
          className='block p-4 border border-border rounded-lg hover:bg-foreground/5 transition-colors'
        >
          <h2 className='font-semibold mb-1'>{property.name}</h2>
          <p className='text-sm text-foreground/60 mb-2'>{property.address}</p>
          <span className='text-sm text-foreground/40'>
            {property.unitCount} {property.unitCount === 1 ? 'unit' : 'units'}
          </span>
        </Link>
      ))}
    </div>
  );
}
