import type { ChargeStatus } from '@/lib/reports/charges';
import { Badge, type badgeVariants } from '@/components/ui/badge';
import type { VariantProps } from 'class-variance-authority';

type BadgeVariant = VariantProps<typeof badgeVariants>['variant'];

const VARIANTS: Record<ChargeStatus, BadgeVariant> = {
  paid: 'success',
  advance: 'secondary',
  partial: 'warning',
  not_due: 'outline',
  unpaid: 'destructive',
  overdue: 'destructive',
};

const LABELS: Record<ChargeStatus, string> = {
  paid: 'Paid',
  advance: 'Paid in advance',
  partial: 'Partially paid',
  not_due: 'Not yet due',
  unpaid: 'Unpaid',
  overdue: 'Overdue',
};

export function ChargeStatusBadge({ status }: { status: ChargeStatus }) {
  return (
    <Badge variant={VARIANTS[status]} className='gap-1.5'>
      <span aria-hidden className='size-1.5 rounded-full bg-current' />
      {LABELS[status]}
    </Badge>
  );
}
