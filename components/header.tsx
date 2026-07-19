'use client';

import { MenuIcon, XIcon } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';

const navigation = [
  { href: '/#properties', label: 'Properties' },
  { href: '/#apartments', label: 'Apartments' },
  { href: '/#commercial', label: 'Commercial' },
  { href: '/#contact', label: 'Contact' },
  { href: '/authenticate', label: 'Log in' },
];

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
 * Public navigation for the landing and authentication pages.
 * Authenticated navigation lives in `components/app-shell.tsx`.
 */
export function Header() {
  const [open, setOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
        menuButtonRef.current?.focus();
      }
    }

    function handlePointerDown(event: PointerEvent) {
      if (!headerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('pointerdown', handlePointerDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [open]);

  function closeMenu() {
    setOpen(false);
  }

  return (
    <header
      ref={headerRef}
      className='sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-md supports-backdrop-filter:bg-background/80'
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setOpen(false);
        }
      }}
    >
      <div className='mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8'>
        <Link
          href='/'
          className='flex min-h-11 items-center gap-2.5 rounded-lg focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
          onClick={closeMenu}
          aria-label='8TURF home'
        >
          <BrandMark className='size-8 rounded-[10px] text-base' />
          <span className='font-heading text-lg font-bold tracking-tight'>8TURF</span>
        </Link>

        <nav className='hidden items-center gap-1 md:flex' aria-label='Main navigation'>
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className='flex h-10 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <button
          ref={menuButtonRef}
          type='button'
          className='inline-flex size-11 items-center justify-center rounded-lg border border-border bg-card text-foreground shadow-[var(--shadow-card)] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:hidden'
          aria-label={open ? 'Close navigation menu' : 'Open navigation menu'}
          aria-expanded={open}
          aria-controls='mobile-navigation'
          onClick={() => setOpen((current) => !current)}
        >
          {open ? <XIcon className='size-5' /> : <MenuIcon className='size-5' />}
        </button>
      </div>

      <nav
        id='mobile-navigation'
        aria-label='Mobile navigation'
        hidden={!open}
        className='absolute inset-x-0 top-full border-b border-border bg-background p-4 shadow-xl md:hidden'
      >
        <div className='mx-auto grid max-w-7xl gap-1'>
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className='flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50'
              onClick={closeMenu}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
    </header>
  );
}
