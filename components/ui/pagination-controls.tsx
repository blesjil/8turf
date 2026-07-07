'use client';

import { Button } from '@/components/ui/button';

export function PaginationControls({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <nav aria-label='Pagination' className='flex items-center justify-center gap-3'>
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={page <= 1}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </Button>
      <span className='text-sm text-muted-foreground'>
        Page {page} of {totalPages}
      </span>
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </nav>
  );
}
