/**
 * The server half of a Loomgate checkout, as a Cloudflare Worker (Hono).
 *
 *   GET  /api/config                    → the publishable key for the page (safe to share)
 *   GET  /api/products                  → the catalog, so the page shows the server's prices
 *   POST /api/checkout                  → prices the cart, creates a payment intent, returns its client secret
 *   GET  /api/orders/:paymentIntentId   → the payment status, for the order page
 *
 * The secret key never leaves this server. The same code runs on Node.js: only the `fetch` export is Worker-specific.
 */
import { createLoomgateServerClient, LoomgateApiError } from '@loompay/loomgate-js-sdk/server';
import { Hono } from 'hono';
import { type CartLine, CURRENCY, PRODUCTS, priceCart } from './catalog';

export interface Env {
  /** `sk_live_…`. Set with `wrangler secret put LOOMGATE_SECRET_KEY`, or in `.dev.vars` locally. */
  LOOMGATE_SECRET_KEY: string;
  /** `pk_live_…`. Safe to send to the browser. */
  LOOMGATE_PUBLISHABLE_KEY: string;
  /** Optional. Defaults to https://api.loomgate.io. */
  LOOMGATE_API_BASE_URL?: string;
}

const DEFAULT_API_BASE_URL = 'https://api.loomgate.io';
const PAYMENT_INTENT_ID = /^lg_pi_[A-Za-z0-9]{1,64}$/;

const app = new Hono<{ Bindings: Env }>();

function apiBaseUrl(env: Env): string {
  return env.LOOMGATE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
}

function loomgate(env: Env) {
  return createLoomgateServerClient(env.LOOMGATE_SECRET_KEY, { apiBaseUrl: apiBaseUrl(env) });
}

function invalidRequest(message: string) {
  return Response.json({ error: { code: 'invalid_request', message } }, { status: 400 });
}

app.get('/api/config', (c) => {
  const publishableKey = c.env.LOOMGATE_PUBLISHABLE_KEY?.trim();
  if (!publishableKey) {
    return c.json({ error: { code: 'not_configured', message: 'LOOMGATE_PUBLISHABLE_KEY is not set.' } }, 500);
  }
  return c.json({ publishableKey, apiBaseUrl: apiBaseUrl(c.env) });
});

app.get('/api/products', (c) => c.json({ currency: CURRENCY, products: PRODUCTS }));

app.post('/api/checkout', async (c) => {
  const request = parseCheckoutRequest(await c.req.json().catch(() => null));
  if (!request.ok) return invalidRequest(request.message);

  const cart = priceCart(request.cart);
  if (!cart.ok) return invalidRequest(cart.message);

  // Your own order number: Loomgate shows it in the dashboard and sends it back in webhooks. In a real shop, create
  // the order in your database first and use its id here and as the idempotency key: a retry for the same order (a
  // timeout, a double submit) then returns the same payment intent instead of creating a second one. This example has
  // no database, so every checkout gets a new reference.
  const orderReference = `order_${crypto.randomUUID()}`;

  try {
    const intent = await loomgate(c.env).paymentIntents.create(
      {
        amount: cart.amount,
        currency: cart.currency,
        items: cart.items,
        order_reference: orderReference,
        buyer: { name: request.name },
        // Physical goods need a shipping address before the buyer can pay.
        shipping_details: { name: request.name, address: request.address },
      },
      { idempotencyKey: orderReference },
    );
    return c.json({
      paymentIntentId: intent.id,
      // Only returned when the intent is created. The page needs it to show the card form.
      clientSecret: intent.client_secret,
      amount: intent.amount_total,
      currency: intent.currency,
    });
  } catch (error) {
    return loomgateError(error, 'We could not start the payment. Please try again.');
  }
});

app.get('/api/orders/:paymentIntentId', async (c) => {
  const id = c.req.param('paymentIntentId');
  if (!PAYMENT_INTENT_ID.test(id)) return c.json({ error: { code: 'not_found', message: 'Order not found.' } }, 404);

  try {
    const intent = await loomgate(c.env).paymentIntents.retrieve(id);
    // Only what the order page needs. `processing` is not paid yet: fulfil the order only once the status is
    // `succeeded` (or your webhook receives `payment_intent.succeeded`).
    return c.json({
      id: intent.id,
      status: intent.status,
      amountTotal: intent.amount_total,
      currency: intent.currency,
      orderReference: intent.order_reference,
    });
  } catch (error) {
    if (error instanceof LoomgateApiError && error.code === 'payment_intent_not_found') {
      return c.json({ error: { code: 'not_found', message: 'Order not found.' } }, 404);
    }
    return loomgateError(error, 'We could not load your order. Please try again.');
  }
});

/** Log the details for yourself, show the buyer a neutral message. */
function loomgateError(error: unknown, message: string) {
  if (!(error instanceof LoomgateApiError)) throw error;
  console.error('Loomgate API error', {
    type: error.type,
    code: error.code,
    status: error.status,
    message: error.message,
  });
  return Response.json({ error: { code: 'payment_unavailable', message } }, { status: 502 });
}

interface ShippingAddress {
  line1: string;
  line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  /** ISO 3166-1 alpha-2, e.g. "US". */
  country: string;
}

type CheckoutRequest =
  | { ok: true; cart: CartLine[]; name: string; address: ShippingAddress }
  | { ok: false; message: string };

/** Checks the shape of the browser's request. Loomgate validates the details again. */
export function parseCheckoutRequest(body: unknown): CheckoutRequest {
  if (!isObject(body)) return { ok: false, message: 'Expected a JSON object.' };
  const { cart, customer, shipping } = body;
  if (!Array.isArray(cart)) return { ok: false, message: 'cart must be a list of { id, quantity }.' };
  if (!isObject(customer) || !isObject(shipping)) return { ok: false, message: 'customer and shipping are required.' };

  const name = text(customer.name);
  if (!name) return { ok: false, message: 'Enter your name.' };
  const line1 = text(shipping.line1);
  if (!line1) return { ok: false, message: 'Enter your address.' };
  const country = text(shipping.country)?.toUpperCase() ?? '';
  if (!/^[A-Z]{2}$/.test(country)) return { ok: false, message: 'Country must be a two-letter code, e.g. US.' };

  return {
    ok: true,
    cart: cart.map((line) => ({
      id: isObject(line) ? String(line.id) : '',
      quantity: isObject(line) ? Number(line.quantity) : Number.NaN,
    })),
    name,
    address: {
      line1,
      line2: text(shipping.line2),
      city: text(shipping.city),
      state: text(shipping.state),
      postal_code: text(shipping.postal_code),
      country,
    },
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A trimmed string of at most 200 characters, or null when empty. */
function text(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().slice(0, 200);
  return trimmed === '' ? null : trimmed;
}

export default app;
