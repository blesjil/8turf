import { cn } from '@/lib/utils';

export function PageContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      data-page-container
      className={cn('mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8 xl:px-8', className)}
    >
      {children}
    </div>
  );
}
