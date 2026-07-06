'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface HeaderProps {
  user?: {
    id: string;
    name: string;
    email: string;
    role?: string | null;
  };
}

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

function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);
  return (
    <Link
      href={href}
      className={cn(
        'rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors',
        active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
    </Link>
  );
}

export function Header({ user }: HeaderProps) {
  return (
    <header className='sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur supports-backdrop-filter:bg-background/75'>
      <div className='mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6'>
        <div className='flex items-center gap-6'>
          <Link href={user ? '/dashboard' : '/'} className='flex items-center gap-2'>
            <BrandMark />
            <span className='text-base font-semibold tracking-tight'>8turf</span>
          </Link>
          {user && (
            <nav className='hidden items-center gap-1 sm:flex'>
              <NavLink href='/dashboard'>Properties</NavLink>
              <NavLink href='/payments'>Payments</NavLink>
              {user.role === 'admin' && <NavLink href='/financial-report'>Financials</NavLink>}
            </nav>
          )}
        </div>
        {user && (
          <DropdownMenu>
            <DropdownMenuTrigger
              render={<Button variant='outline' size='sm' />}
              className='max-w-48'
            >
              <span className='truncate'>{user.name}</span>
            </DropdownMenuTrigger>
            <DropdownMenuContent align='end' className='w-56'>
              <DropdownMenuLabel>
                <div className='grid gap-0.5'>
                  <span className='truncate font-medium'>{user.name}</span>
                  <span className='truncate text-xs font-normal text-muted-foreground'>
                    {user.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem render={<Link href='/dashboard' />}>Properties</DropdownMenuItem>
              <DropdownMenuItem render={<Link href='/payments' />}>Payments</DropdownMenuItem>
              {user.role === 'admin' && (
                <>
                  <DropdownMenuItem render={<Link href='/financial-report' />}>
                    Financial report
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href='/properties/archived' />}>
                    Archived properties
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href='/admin/users' />}>
                    Manage users
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  signOut({
                    fetchOptions: {
                      onSuccess: () => {
                        window.location.href = '/';
                      },
                    },
                  })
                }
              >
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </header>
  );
}
