import type { PaymentStatus } from '@/lib/payment-status';
import { Badge, type badgeVariants } from '@/components/ui/badge';
import type { VariantProps } from 'class-variance-authority';

type BadgeStatus = PaymentStatus | 'not_due' | 'inactive';
type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

const VARIANTS: Record<BadgeStatus, BadgeVariant> = {
  paid: 'success',
  partial: 'warning',
  unpaid: 'destructive',
  not_due: 'outline',
  inactive: 'neutral',
};

const LABELS: Record<BadgeStatus, string> = {
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
  not_due: 'Not yet due',
  inactive: 'Inactive',
};

export function PaymentStatusBadge({ status }: { status: BadgeStatus }) {
  return (
    <Badge variant={VARIANTS[status]} className='gap-1.5'>
      <span aria-hidden className='size-1.5 rounded-full bg-current' />
      {LABELS[status]}
    </Badge>
  );
}
