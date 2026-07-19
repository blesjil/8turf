'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ArchiveIcon,
  CreditCardIcon,
  LayoutDashboardIcon,
  LineChartIcon,
  LogOutIcon,
  MenuIcon,
  ContactRoundIcon,
  UsersIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';
import { signOut } from '@/lib/auth-client';
import { BrandMark } from '@/components/header';
import { cn } from '@/lib/utils';

interface AppShellUser {
  id: string;
  name: string;
  email: string;
  role?: string | null;
}

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  match?: string[];
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export function buildGroups(isAdmin: boolean): NavGroup[] {
  const groups: NavGroup[] = [
    {
      label: 'Overview',
      items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboardIcon }],
    },
    {
      label: 'Money',
      items: [
        { href: '/payments', label: 'Payments', icon: CreditCardIcon },
        ...(isAdmin
          ? [{ href: '/financial-report', label: 'Financial Report', icon: LineChartIcon }]
          : []),
      ],
    },
    {
      label: 'Maintenance',
      items: [
        {
          href: '/maintenance/contacts',
          label: 'Contacts',
          icon: ContactRoundIcon,
          match: ['/maintenance'],
        },
      ],
    },
  ];
  if (isAdmin) {
    groups.push({
      label: 'Admin',
      items: [
        { href: '/properties/archived', label: 'Archived properties', icon: ArchiveIcon },
        { href: '/admin/users', label: 'Manage users', icon: UsersIcon },
      ],
    });
  }
  return groups;
}

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? '')
      .join('') || '8'
  );
}

function NavLink({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const pathname = usePathname();
  const active = [item.href, ...(item.match ?? [])].some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-success-muted text-primary'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground',
      )}
    >
      <Icon className={cn('size-[18px] shrink-0', active ? 'opacity-100' : 'opacity-80')} />
      {item.label}
    </Link>
  );
}

export function AppShell({ user, children }: { user: AppShellUser; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const groups = buildGroups(user.role === 'admin');
  const close = () => setOpen(false);

  // Close on Escape and lock body scroll while the drawer is open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open]);

  return (
    <div className='grid min-h-screen grid-cols-1 lg:grid-cols-[240px_1fr]'>
      {/* Sidebar — sticky column on desktop, slide-over drawer on mobile */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[250px] flex-col gap-5 border-r border-border bg-card p-3.5 shadow-2xl transition-transform duration-200',
          'lg:sticky lg:top-0 lg:z-30 lg:h-screen lg:w-auto lg:translate-x-0 lg:shadow-none',
          open ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className='flex items-center justify-between'>
          <Link href='/dashboard' className='flex items-center gap-2.5 px-1.5 py-1' onClick={close}>
            <BrandMark className='size-8 rounded-[9px] text-[15px]' />
            <span className='font-heading text-lg font-bold tracking-tight'>8TURF</span>
          </Link>
          <button
            type='button'
            onClick={close}
            aria-label='Close menu'
            className='grid size-9 place-items-center rounded-lg text-muted-foreground hover:bg-muted lg:hidden'
          >
            <XIcon className='size-[18px]' />
          </button>
        </div>

        <nav className='flex flex-col gap-4 overflow-y-auto'>
          {groups.map((group) => (
            <div key={group.label} className='flex flex-col gap-0.5'>
              <span className='px-2.5 pt-1 pb-1 text-[10.5px] font-semibold tracking-[0.1em] text-muted-foreground uppercase'>
                {group.label}
              </span>
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} onNavigate={close} />
              ))}
            </div>
          ))}
        </nav>

        {/* Account block */}
        <div className='mt-auto flex flex-col gap-2 border-t border-border pt-3'>
          <div className='flex items-center gap-2.5 px-1.5'>
            <span
              className='grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-[13px] font-semibold text-primary-foreground'
              aria-hidden
            >
              {initials(user.name)}
            </span>
            <div className='grid min-w-0 gap-0.5'>
              <span className='truncate text-sm font-medium'>{user.name}</span>
              <span className='truncate text-xs text-muted-foreground'>{user.email}</span>
            </div>
          </div>
          <button
            type='button'
            onClick={() =>
              signOut({
                fetchOptions: {
                  onSuccess: () => {
                    window.location.href = '/';
                  },
                },
              })
            }
            className='flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
          >
            <LogOutIcon className='size-[18px] shrink-0 opacity-80' />
            Log out
          </button>
        </div>
      </aside>

      {/* Scrim */}
      <button
        type='button'
        aria-label='Close menu'
        tabIndex={open ? 0 : -1}
        onClick={close}
        className={cn(
          'fixed inset-0 z-40 bg-foreground/40 transition-opacity duration-200 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
      />

      {/* Main column */}
      <div className='flex min-w-0 flex-col'>
        {/* Mobile top bar */}
        <div className='flex items-center justify-between border-b border-border bg-card px-4 py-3 lg:hidden'>
          <button
            type='button'
            onClick={() => setOpen(true)}
            aria-label='Open menu'
            aria-expanded={open}
            className='grid size-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground shadow-[var(--shadow-card)]'
          >
            <MenuIcon className='size-[18px]' />
          </button>
          <Link href='/dashboard' className='flex items-center gap-2'>
            <BrandMark />
            <span className='font-heading text-base font-bold tracking-tight'>8TURF</span>
          </Link>
          <span
            className='grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-primary to-secondary text-[13px] font-semibold text-primary-foreground'
            aria-hidden
          >
            {initials(user.name)}
          </span>
        </div>

        <main className='min-w-0 flex-1'>{children}</main>
      </div>
    </div>
  );
}
