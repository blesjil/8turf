export function dollarsToCents(input: string): number {
  return Math.round(parseFloat(input) * 100);
}

export function formatCents(cents: number): string {
  const formatted = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(cents / 100);
  return formatted.replace(/^(\D+)/, '$1 ');
}
