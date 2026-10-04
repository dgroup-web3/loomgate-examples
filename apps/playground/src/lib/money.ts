/** Amounts are in the smallest currency unit (cents) everywhere in the API. usd and eur have 2 decimals. */

/** Largest amount Loomgate accepts: 99 999 999 minor units. */
export const MAX_AMOUNT = 99_999_999;

/** "12.50" → 1250. null when it is not a valid amount (at most 2 decimals, comma or dot). */
export function parseAmount(input: string): number | null {
  const match = /^(\d{1,6})(?:[.,](\d{1,2}))?$/.exec(input.trim());
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return cents <= MAX_AMOUNT ? cents : null;
}

/** 1250 → "12.50", for an input field. */
export function toMajorInput(amount: number): string {
  return (amount / 100).toFixed(2);
}

/** 1250, 'usd' → "$12.50". */
export function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency.toUpperCase() }).format(amount / 100);
}
