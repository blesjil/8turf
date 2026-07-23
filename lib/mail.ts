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
    from: `"8TURF Apartments" <${gmailUser}>`,
    to,
    subject: `Payment received — ${formatCents(details.amount)} (${months.join(', ')})`,
    text,
    html,
  });
}

export interface PaymentReminderDetails {
  tenantName: string;
  propertyName: string;
  unitLabel: string;
  monthLabel: string; // e.g. "July 2026"
  dueDate: string; // YYYY-MM-DD
  rentAmount: number; // integer cents
  amountPaid: number; // integer cents
  amountDue: number; // integer cents
}

// Returns false when the mailer isn't configured, so callers can surface
// "email not configured" instead of claiming the reminder was sent.
export async function sendPaymentReminder(
  to: string,
  details: PaymentReminderDetails,
): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('GMAIL_USER/GMAIL_APP_PASSWORD not set — skipping payment reminder email');
    return false;
  }

  const rows: [string, string][] = [
    ['Property', `${details.propertyName} — Unit ${details.unitLabel}`],
    ['Month', details.monthLabel],
    ['Due date', formatDate(details.dueDate)],
    ['Monthly rent', formatCents(details.rentAmount)],
  ];
  if (details.amountPaid > 0) rows.push(['Paid so far', formatCents(details.amountPaid)]);
  rows.push(['Balance due', formatCents(details.amountDue)]);

  const text = [
    `Hi ${details.tenantName},`,
    '',
    `This is a friendly reminder that your rent for ${details.monthLabel} has an outstanding balance:`,
    '',
    ...rows.map(([label, value]) => `${label}: ${value}`),
    '',
    'If you have already settled this, kindly disregard this message.',
    '',
    'Thank you!',
  ].join('\n');

  const html = `
    <p>Hi ${escapeHtml(details.tenantName)},</p>
    <p>This is a friendly reminder that your rent for ${escapeHtml(details.monthLabel)} has an outstanding balance:</p>
    <table cellpadding="4" style="border-collapse:collapse">
      ${rows
        .map(
          ([label, value]) =>
            `<tr><td style="color:#555;padding-right:12px">${escapeHtml(label)}</td><td><strong>${escapeHtml(value)}</strong></td></tr>`,
        )
        .join('')}
    </table>
    <p>If you have already settled this, kindly disregard this message.</p>
    <p>Thank you!</p>
  `;

  await transporter.sendMail({
    from: `"8TURF Apartments" <${gmailUser}>`,
    to,
    subject: `Rent reminder — ${formatCents(details.amountDue)} due for ${details.monthLabel}`,
    text,
    html,
  });
  return true;
}

export interface TemporaryPasswordDetails {
  name: string;
  password: string;
  isNewAccount: boolean;
}

// Returns false when the mailer isn't configured, so callers can fall back
// to showing the password on screen instead of claiming it was emailed.
export async function sendTemporaryPassword(
  to: string,
  details: TemporaryPasswordDetails,
): Promise<boolean> {
  const transporter = getTransporter();
  if (!transporter) {
    console.warn('GMAIL_USER/GMAIL_APP_PASSWORD not set — skipping temporary password email');
    return false;
  }

  const signInUrl = process.env.BETTER_AUTH_URL;
  const intro = details.isNewAccount
    ? 'An account has been created for you on 8TURF Apartments.'
    : 'Your 8TURF Apartments password has been reset.';

  const text = [
    `Hi ${details.name},`,
    '',
    intro,
    '',
    `Email: ${to}`,
    `Temporary password: ${details.password}`,
    '',
    ...(signInUrl
      ? [`Sign in at ${signInUrl} and change your password after logging in.`]
      : ['Please change your password after logging in.']),
    '',
    'Thank you!',
  ].join('\n');

  const html = `
    <p>Hi ${escapeHtml(details.name)},</p>
    <p>${intro}</p>
    <table cellpadding="4" style="border-collapse:collapse">
      <tr><td style="color:#555;padding-right:12px">Email</td><td><strong>${escapeHtml(to)}</strong></td></tr>
      <tr><td style="color:#555;padding-right:12px">Temporary password</td><td><strong style="font-family:monospace">${escapeHtml(details.password)}</strong></td></tr>
    </table>
    <p>${
      signInUrl
        ? `<a href="${escapeHtml(signInUrl)}">Sign in</a> and change your password after logging in.`
        : 'Please change your password after logging in.'
    }</p>
    <p>Thank you!</p>
  `;

  await transporter.sendMail({
    from: `"8TURF Apartments" <${gmailUser}>`,
    to,
    subject: details.isNewAccount
      ? 'Your 8TURF Apartments account'
      : 'Your 8TURF Apartments password was reset',
    text,
    html,
  });
  return true;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
