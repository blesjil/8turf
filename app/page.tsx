import Link from 'next/link';

export default function Home() {
  return (
    <div className='flex min-h-screen items-center justify-center p-8'>
      <main className='max-w-md text-center'>
        <h1 className='text-4xl font-bold mb-4'>8Turf</h1>
        <p className='text-foreground/60 mb-8'>
          Track your properties, units, tenants, and rent payments in one place.
        </p>
        <Link
          href='/authenticate'
          className='inline-block px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800'
        >
          Log in
        </Link>
      </main>
    </div>
  );
}
