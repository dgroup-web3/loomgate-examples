/**
 * Your product catalog. In a real shop this comes from your database.
 *
 * The server always decides the price: the browser only says which products and how many. Never trust an amount
 * sent by the browser.
 */
import type { Currency, PaymentItemParams } from '@loompay/loomgate-js-sdk/server';

export interface Product {
  id: string;
  name: string;
  /** Smallest currency unit: 100 = $1.00. */
  unitAmount: number;
}

/**
 * Payments use real money (there is no test mode), so the example prices are small. Loomgate's minimum is $1.00, and
 * when you bear the fees the amount must also be more than them (fixed fees alone can be around $0.60).
 */
export const CURRENCY: Currency = 'usd';

export const PRODUCTS: readonly Product[] = [
  { id: 'sticker', name: 'Loomgate sticker', unitAmount: 100 },
  { id: 'pin', name: 'Loomgate enamel pin', unitAmount: 150 },
];

export const MAX_QUANTITY = 10;

export interface CartLine {
  id: string;
  quantity: number;
}

export type PricedCart =
  | { ok: true; currency: Currency; amount: number; items: PaymentItemParams[] }
  | { ok: false; message: string };

export function priceCart(lines: readonly CartLine[]): PricedCart {
  if (lines.length === 0) return { ok: false, message: 'The cart is empty.' };

  const seen = new Set<string>();
  const items: PaymentItemParams[] = [];
  let amount = 0;
  for (const line of lines) {
    const product = PRODUCTS.find((candidate) => candidate.id === line.id);
    if (!product) return { ok: false, message: `Unknown product: ${line.id}.` };
    if (seen.has(product.id)) return { ok: false, message: `${product.name} is in the cart twice.` };
    seen.add(product.id);
    if (!Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > MAX_QUANTITY) {
      return { ok: false, message: `Quantity must be a whole number from 1 to ${MAX_QUANTITY}.` };
    }
    items.push({ name: product.name, quantity: line.quantity, unit_amount: product.unitAmount });
    amount += product.unitAmount * line.quantity;
  }
  return { ok: true, currency: CURRENCY, amount, items };
}
