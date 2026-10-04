/**
 * The order the developer types in step 1, and how it becomes the body of `POST /partner/v1/payment_intents`.
 * Items describe the amount; Loomgate charges `amount` (it reports a mismatch as `items_difference`). Here `amount` is
 * always items + shipping + tax − discount, as a shop would compute it.
 */
import type { CreatePaymentIntentParams, Currency, GoodsType } from '@loompay/loomgate-js-sdk/server';
import { parseAmount } from './money';

export interface ItemDraft {
  key: string;
  name: string;
  /** "1", "0.5": up to 3 decimals. */
  quantity: string;
  /** "12.50". */
  unitPrice: string;
}

export interface AddressDraft {
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postalCode: string;
  /** ISO 3166-1 alpha-2. */
  country: string;
}

export interface OrderDraft {
  currency: Currency;
  items: ItemDraft[];
  shipping: string;
  tax: string;
  discount: string;
  goodsType: GoodsType;
  buyerName: string;
  orderReference: string;
  address: AddressDraft;
}

let itemSeq = 0;

export function newItem(name = '', quantity = '1', unitPrice = ''): ItemDraft {
  itemSeq += 1;
  return { key: `item-${itemSeq}`, name, quantity, unitPrice };
}

export function newOrderReference(): string {
  return `PLAYGROUND-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Payments are real, so the playground starts small: $1.00. Loomgate's minimum is $0.50, and when the merchant bears
 * the fees the amount must also be more than them.
 */
export function defaultDraft(): OrderDraft {
  return {
    currency: 'usd',
    items: [newItem('Test item', '1', '1.00')],
    shipping: '',
    tax: '',
    discount: '',
    goodsType: 'physical',
    buyerName: '',
    orderReference: newOrderReference(),
    address: { name: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: 'US' },
  };
}

export type BuildResult = { ok: true; params: CreatePaymentIntentParams } | { ok: false; problems: string[] };

/** Quantity "0.335" → { value: 0.335, milli: 335n }. */
function parseQuantity(input: string): { value: number; milli: bigint } | null {
  const match = /^(\d{1,7})(?:[.,](\d{1,3}))?$/.exec(input.trim());
  if (!match) return null;
  const milli = BigInt(match[1]!) * 1000n + BigInt((match[2] ?? '').padEnd(3, '0'));
  if (milli <= 0n) return null;
  return { value: Number(`${match[1]}.${match[2] ?? '0'}`), milli };
}

export function buildPaymentIntentParams(draft: OrderDraft): BuildResult {
  const problems: string[] = [];
  const items: CreatePaymentIntentParams['items'] = [];
  let total = 0n;

  draft.items.forEach((item, index) => {
    const label = `Item ${index + 1}`;
    const name = item.name.trim();
    const quantity = parseQuantity(item.quantity);
    const unit = parseAmount(item.unitPrice);
    if (!name) problems.push(`${label}: enter a name.`);
    if (!quantity) problems.push(`${label}: quantity must be greater than 0, with at most 3 decimals.`);
    if (unit === null) problems.push(`${label}: unit price must be an amount such as 12.50.`);
    if (name && quantity && unit !== null) {
      items.push({ name, quantity: quantity.value, unit_amount: unit });
      // Line amount = unit price × quantity, rounded half up once (as Loomgate computes it).
      total += (BigInt(unit) * quantity.milli + 500n) / 1000n;
    }
  });
  if (draft.items.length === 0) problems.push('Add at least one item.');

  const extra = (input: string, label: string): number => {
    if (input.trim() === '') return 0;
    const value = parseAmount(input);
    if (value === null) problems.push(`${label} must be an amount such as 5.00.`);
    return value ?? 0;
  };
  const shipping = extra(draft.shipping, 'Shipping');
  const tax = extra(draft.tax, 'Tax');
  const discount = extra(draft.discount, 'Discount');

  const buyerName = draft.buyerName.trim();
  if (!buyerName) problems.push('Enter the buyer name.');
  const orderReference = draft.orderReference.trim();
  if (!orderReference) problems.push('Enter an order reference.');

  const physical = draft.goodsType === 'physical';
  const address = draft.address;
  const country = address.country.trim().toUpperCase();
  if (physical) {
    if (!address.line1.trim()) problems.push('Enter the address line.');
    if (!/^[A-Z]{2}$/.test(country)) problems.push('Country must be a two-letter code such as US.');
  }

  if (problems.length > 0) return { ok: false, problems };

  total += BigInt(shipping) + BigInt(tax) - BigInt(discount);
  if (total < 0n) return { ok: false, problems: ['The total cannot be below zero.'] };

  const optional = (value: string) => value.trim() || null;
  return {
    ok: true,
    params: {
      amount: Number(total),
      currency: draft.currency,
      items,
      shipping_amount: shipping,
      tax_amount: tax,
      discount_amount: discount,
      goods_type: draft.goodsType,
      buyer: { name: buyerName },
      order_reference: orderReference,
      ...(physical
        ? {
            shipping_details: {
              name: address.name.trim() || buyerName,
              address: {
                line1: address.line1.trim(),
                line2: optional(address.line2),
                city: optional(address.city),
                state: optional(address.state),
                postal_code: optional(address.postalCode),
                country,
              },
            },
          }
        : {}),
    },
  };
}
