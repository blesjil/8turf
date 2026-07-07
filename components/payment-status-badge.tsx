import type { PaymentStatus } from '@/lib/payment-status';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type BadgeStatus = PaymentStatus | 'inactive';

const STYLES: Record<BadgeStatus, string> = {
  paid: 'bg-success-muted text-success',
  partial: 'bg-warning-muted text-warning',
  unpaid: 'bg-danger-muted text-destructive',
  inactive: 'bg-muted text-muted-foreground',
};

const LABELS: Record<BadgeStatus, string> = {
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
  inactive: 'Inactive',
};

export function PaymentStatusBadge({ status }: { status: BadgeStatus }) {
  return (
    <Badge variant='secondary' className={cn('gap-1.5', STYLES[status])}>
      <span aria-hidden className='size-1.5 rounded-full bg-current' />
      {LABELS[status]}
    </Badge>
  );
}
