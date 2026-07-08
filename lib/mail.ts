import nodemailer, { type Transporter } from 'nodemailer';
import { formatCents } from '@/lib/money';
import { formatDate, formatPeriod } from '@/lib/format-date';
import { coveredPeriods } from '@/lib/payment-status';

const gmailUser = process.env.GMAIL_USER;
const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;

// Survive Next.js dev-server module reloads with a single transport
const globalForMail = globalThis as unknown as { mailTransporter?: Transporter };

function getTransporter(): Transporter | null {
  if (!gmailUser || !gmailAppPassword) return null;
  if (!globalForMail.mailTransporter) {
    globalForMail.mailTransporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailAppPassword },
    });
  }
  return globalForMail.mailTransporter;
}

export interface PaymentReceiptDetails {
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  amount: number; // integer cents
  paidDate: string; // YYYY-MM-DD
  periodStart: string; // YYYY-MM-DD
  periodEnd: string; // YYYY-MM-DD
  paymentType: string;
  method: string | null;
}

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  rental: 'Rental',
  advance: 'Advance',
  deposit: 'Deposit',
  reservation: 'Reservation',
};

export async function sendPaymentReceipt(
  to: string,
  details: PaymentReceiptDetails,
): Promise<void> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('GMAIL_USER/GMAIL_APP_PASSWORD not set — skipping payment receipt email');
    return;
  }

  const months = coveredPeriods(details.periodStart, details.periodEnd).map(formatPeriod);
  const typeLabel = PAYMENT_TYPE_LABELS[details.paymentType] ?? details.paymentType;
  const rows: [string, string][] = [
    ['Property', `${details.propertyName} — Unit ${details.unitLabel}`],
    ['Amount', formatCents(details.amount)],
    ['Payment type', typeLabel],
    ['Date paid', formatDate(details.paidDate)],
    ['Covers', months.join(', ')],
  ];
  if (details.method) rows.push(['Method', details.method]);

  const text = [
    `Hi ${details.tenantName},`,
    '',
    'We received your payment. Here are the details:',
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'Thank you!',
  ].join('\n');

  const html = `
    <p>Hi ${escapeHtml(details.tenantName)},</p>
    <p>We received your payment. Here are the details:</p>
    <table cellpadding="4" style="border-collapse:collapse">
      ${rows
        .map(
          ([label, value]) =>
            `<tr><td style="color:#555;padding-right:12px">${escapeHtml(label)}</td><td><strong>${escapeHtml(value)}</strong></td></tr>`,
        )
        .join('')}
    </table>
    <p>Thank you!</p>
  `;

  await transporter.sendMail({
    from: `"8Turf Apartments" <${gmailUser}>`,
    to,
    subject: `Payment received — ${formatCents(details.amount)} (${months.join(', ')})`,
    text,
    html,
  });
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
