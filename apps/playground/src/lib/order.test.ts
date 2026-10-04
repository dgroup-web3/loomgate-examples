import { describe, expect, it } from 'vitest';
import { buildPaymentIntentParams, defaultDraft, type OrderDraft } from './order';

const draft: OrderDraft = {
  ...defaultDraft(),
  currency: 'usd',
  items: [
    { key: 'a', name: 'Mug', quantity: '2', unitPrice: '4.50' },
    { key: 'b', name: 'Sticker', quantity: '1', unitPrice: '1' },
  ],
  shipping: '2.00',
  tax: '0.50',
  discount: '1',
  goodsType: 'physical',
  buyerName: 'Jane Buyer',
  orderReference: 'ORDER-1',
  address: {
    name: 'Jane Buyer',
    line1: '1 Main St',
    line2: '',
    city: 'Austin',
    state: 'TX',
    postalCode: '78701',
    country: 'us',
  },
};

describe('buildPaymentIntentParams', () => {
  it('builds the create-payment-intent body, amount = items + shipping + tax − discount', () => {
    const result = buildPaymentIntentParams(draft);
    expect(result).toEqual({
      ok: true,
      params: {
        amount: 900 + 100 + 200 + 50 - 100,
        currency: 'usd',
        items: [
          { name: 'Mug', quantity: 2, unit_amount: 450 },
          { name: 'Sticker', quantity: 1, unit_amount: 100 },
        ],
        shipping_amount: 200,
        tax_amount: 50,
        discount_amount: 100,
        goods_type: 'physical',
        buyer: { name: 'Jane Buyer' },
        order_reference: 'ORDER-1',
        shipping_details: {
          name: 'Jane Buyer',
          address: {
            line1: '1 Main St',
            line2: null,
            city: 'Austin',
            state: 'TX',
            postal_code: '78701',
            country: 'US',
          },
        },
      },
    });
  });

  it('accepts fractional quantities with up to 3 decimals and rounds each line half up', () => {
    const result = buildPaymentIntentParams({
      ...draft,
      items: [{ key: 'a', name: 'Cheese (kg)', quantity: '0.335', unitPrice: '10.00' }],
      shipping: '',
      tax: '',
      discount: '',
    });
    expect(result.ok && result.params.amount).toBe(335);
    expect(result.ok && result.params.items[0]?.quantity).toBe(0.335);
  });

  it('leaves out shipping details for non-physical goods', () => {
    const result = buildPaymentIntentParams({ ...draft, goodsType: 'non_physical' });
    expect(result.ok && 'shipping_details' in result.params).toBe(false);
  });

  it('lists every problem', () => {
    const result = buildPaymentIntentParams({
      ...draft,
      items: [{ key: 'a', name: '', quantity: '0', unitPrice: 'x' }],
      buyerName: '',
      address: { ...draft.address, line1: '', country: 'USA' },
    });
    expect(result.ok).toBe(false);
    expect(!result.ok && result.problems).toEqual([
      'Item 1: enter a name.',
      'Item 1: quantity must be greater than 0, with at most 3 decimals.',
      'Item 1: unit price must be an amount such as 12.50.',
      'Enter the buyer name.',
      'Enter the address line.',
      'Country must be a two-letter code such as US.',
    ]);
  });

  it('refuses a total below zero', () => {
    const result = buildPaymentIntentParams({ ...draft, discount: '100' });
    expect(!result.ok && result.problems).toEqual(['The total cannot be below zero.']);
  });
});
