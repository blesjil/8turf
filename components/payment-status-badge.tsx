import type { PaymentStatus } from '@/lib/payment-status';

const STYLES: Record<PaymentStatus, string> = {
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
  partial: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
  unpaid: 'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
};

const LABELS: Record<PaymentStatus, string> = {
  paid: 'Paid',
  partial: 'Partial',
  unpaid: 'Unpaid',
};

export function PaymentStatusBadge({ status }: { status: PaymentStatus }) {
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
