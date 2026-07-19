import Link from 'next/link';
import { cn } from '@/lib/utils';

export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'flex size-7 items-center justify-center rounded-lg bg-primary font-mono text-sm font-semibold text-primary-foreground',
        className,
      )}
      aria-hidden
    >
      8
    </span>
  );
}

/**
 * Minimal public header for logged-out pages (landing, /authenticate).
 * Authenticated navigation lives in `components/app-shell.tsx`.
 */
export function Header() {
  return (
    <header className='sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur-md supports-backdrop-filter:bg-background/75'>
      <div className='mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6'>
        <Link href='/' className='flex items-center gap-2'>
          <BrandMark />
          <span className='font-heading text-base font-bold tracking-tight'>8TURF</span>
        </Link>
      </div>
    </header>
  );
}
