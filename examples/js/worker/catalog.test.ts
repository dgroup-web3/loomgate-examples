import { describe, expect, it } from 'vitest';
import { priceCart } from './catalog';

describe('priceCart', () => {
  it('prices the cart from the catalog, never from the browser', () => {
    const result = priceCart([{ id: 'sticker', quantity: 2 }]);
    expect(result).toEqual({
      ok: true,
      currency: 'usd',
      amount: 200,
      items: [{ name: 'Loomgate sticker', quantity: 2, unit_amount: 100 }],
    });
  });

  it('adds up several lines', () => {
    const result = priceCart([
      { id: 'sticker', quantity: 1 },
      { id: 'pin', quantity: 1 },
    ]);
    expect(result.ok && result.amount).toBe(100 + 150);
  });

  it('refuses an unknown product', () => {
    expect(priceCart([{ id: 'laptop', quantity: 1 }])).toEqual({ ok: false, message: 'Unknown product: laptop.' });
  });

  it.each([0, -1, 1.5, 11, Number.NaN])('refuses quantity %s', (quantity) => {
    expect(priceCart([{ id: 'sticker', quantity }]).ok).toBe(false);
  });

  it('refuses an empty cart', () => {
    expect(priceCart([])).toEqual({ ok: false, message: 'The cart is empty.' });
  });

  it('refuses the same product twice', () => {
    expect(
      priceCart([
        { id: 'sticker', quantity: 1 },
        { id: 'sticker', quantity: 1 },
      ]).ok,
    ).toBe(false);
  });
});
