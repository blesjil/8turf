import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { BrandMark } from '@/components/header';

export default function Home() {
  return (
    <div className='flex min-h-[calc(100vh-3.5rem)] items-center justify-center p-8'>
      <main className='max-w-md text-center'>
        <BrandMark className='mx-auto mb-6 size-12 rounded-xl text-2xl' />
        <h1 className='mb-3 text-4xl font-semibold tracking-tight'>8turf</h1>
        <p className='mb-8 text-balance text-muted-foreground'>
          Track your properties, units, tenants, and rent payments in one place.
        </p>
        <Button
          nativeButton={false}
          render={<Link href='/authenticate' />}
          size='lg'
          className='px-8'
        >
          Log in
        </Button>
      </main>
    </div>
  );
}
