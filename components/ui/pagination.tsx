import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export const PAGE_SIZE = 20;

export function clampPage(raw: string | undefined, totalPages: number): number {
  const parsed = Number.parseInt(raw ?? '1', 10);
  if (Number.isNaN(parsed) || parsed < 1) return 1;
  return Math.min(parsed, Math.max(totalPages, 1));
}

export function paginate<T>(items: T[], page: number): T[] {
  return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}

function pageButtonClass(disabled: boolean) {
  return cn(
    buttonVariants({ variant: 'outline', size: 'sm' }),
    disabled && 'pointer-events-none opacity-50',
  );
}

export function PaginationNav({
  page,
  totalPages,
  basePath,
  params = {},
  pageParam = 'page',
}: {
  page: number;
  totalPages: number;
  basePath: string;
  params?: Record<string, string | undefined>;
  pageParam?: string;
}) {
  if (totalPages <= 1) return null;

  const hrefFor = (target: number) => {
    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value) search.set(key, value);
    }
    if (target > 1) search.set(pageParam, String(target));
    const qs = search.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  return (
    <nav aria-label='Pagination' className='mt-4 flex items-center justify-center gap-3'>
      <Link
        href={hrefFor(page - 1)}
        aria-disabled={page <= 1}
        tabIndex={page <= 1 ? -1 : undefined}
        className={pageButtonClass(page <= 1)}
      >
        Previous
      </Link>
      <span className='text-sm text-muted-foreground'>
        Page {page} of {totalPages}
      </span>
      <Link
        href={hrefFor(page + 1)}
        aria-disabled={page >= totalPages}
        tabIndex={page >= totalPages ? -1 : undefined}
        className={pageButtonClass(page >= totalPages)}
      >
        Next
      </Link>
    </nav>
  );
}
