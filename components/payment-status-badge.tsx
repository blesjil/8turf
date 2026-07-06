import type { PaymentStatus } from '@/lib/payment-status';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

const STYLES: Record<PaymentStatus, string> = {
  paid: 'bg-success-muted text-success',
  partial: 'bg-warning-muted text-warning',
  unpaid: 'bg-danger-muted text-destructive',
};

const LABELS: Record<PaymentStatus, string> = {
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <Badge variant='secondary' className={cn('gap-1.5', STYLES[status])}>
      <span aria-hidden className='size-1.5 rounded-full bg-current' />
      {LABELS[status]}
    </Badge>
  );
}
