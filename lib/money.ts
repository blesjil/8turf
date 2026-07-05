export function dollarsToCents(input: string): number {
  return Math.round(parseFloat(input) * 100);
}

export function formatCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}
