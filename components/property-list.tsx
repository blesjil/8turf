import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface PropertyListItem {
  id: string;
  name: string;
  address: string;
  unitCount: number;
  ownerName?: string | null;
}

export function PropertyList({ properties }: { properties: PropertyListItem[] }) {
  if (properties.length === 0) {
    return (
      <Card className='items-center py-12 text-center'>
        <CardHeader className='items-center'>
          <CardTitle>No properties yet</CardTitle>
          <CardDescription>Add your first property to start tracking rent.</CardDescription>
        </CardHeader>
        <Button nativeButton={false} render={<Link href='/properties/new' />} className='mx-auto'>
          New property
        </Button>
      </Card>
    );
  }

  return (
    <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-3'>
      {properties.map((property) => (
        <Link key={property.id} href={`/properties/${property.id}`} className='group'>
          <Card className='h-full transition-colors group-hover:border-primary/40'>
            <CardHeader>
              <div className='flex items-start justify-between gap-2'>
                <CardTitle className='group-hover:text-primary'>{property.name}</CardTitle>
                <Badge variant='secondary' className='shrink-0 font-mono'>
                  {property.unitCount} {property.unitCount === 1 ? 'unit' : 'units'}
                </Badge>
              </div>
              <CardDescription>{property.address}</CardDescription>
              {property.ownerName && (
                <Badge variant='outline' className='mt-1 w-fit'>
                  {property.ownerName}
                </Badge>
              )}
            </CardHeader>
          </Card>
        </Link>
      ))}
    </div>
  );
}
