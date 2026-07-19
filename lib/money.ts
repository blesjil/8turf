export function dollarsToCents(input: string): number {
  return Math.round(parseFloat(input) * 100);
}

export function centsFromFormData(
  formData: Pick<FormData, 'get'>,
  centsField: string,
  dollarsField: string,
): FormDataEntryValue | number | null {
  const dollars = formData.get(dollarsField);
  if (typeof dollars === 'string' && dollars.trim() !== '') {
    return dollarsToCents(dollars);
  }
  return formData.get(centsField);
}

export function formatCents(cents: number): string {
  const formatted = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
  }).format(cents / 100);
  return formatted.replace(/^(\D+)/, '$1 ');
}

// Compact form for KPI tiles where the full grouped amount is too wide, e.g.
// "₱ 4.2M". Same data as formatCents, just fewer glyphs.
export function formatCentsCompact(cents: number): string {
  const formatted = new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(cents / 100);
  return formatted.replace(/^(\D+)/, '$1 ');
}
