import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app, { type Env } from './index';

const env: Env = {
  LOOMGATE_SECRET_KEY: 'sk_live_test_fixture_not_a_real_key',
  LOOMGATE_PUBLISHABLE_KEY: 'pk_live_test_fixture_not_a_real_key',
};

const checkoutBody = {
  cart: [{ id: 'sticker', quantity: 2 }],
  customer: { name: 'Jane Buyer' },
  shipping: { line1: '1 Market St', city: 'San Francisco', state: 'CA', postal_code: '94105', country: 'us' },
};

function intent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'lg_pi_abc123',
    object: 'payment_intent',
    status: 'pending',
    currency: 'usd',
    amount: 100,
    amount_total: 100,
    order_reference: 'order_1',
    client_secret: 'lg_cs_secret',
    ...overrides,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function post(path: string, body: unknown) {
  return app.request(
    path,
    { method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } },
    env,
  );
}

describe('GET /api/config', () => {
  it('returns the publishable key and the API base URL', async () => {
    const res = await app.request('/api/config', {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      publishableKey: env.LOOMGATE_PUBLISHABLE_KEY,
      apiBaseUrl: 'https://api.loomgate.io',
    });
  });

  it('never returns the secret key', async () => {
    const res = await app.request('/api/config', {}, env);
    expect(await res.text()).not.toContain(env.LOOMGATE_SECRET_KEY);
  });

  it('fails clearly when the publishable key is not set', async () => {
    const res = await app.request('/api/config', {}, { ...env, LOOMGATE_PUBLISHABLE_KEY: '' });
    expect(res.status).toBe(500);
  });
});

describe('GET /api/products', () => {
  it('returns the catalog with the server prices', async () => {
    const res = await app.request('/api/products', {}, env);
    expect(await res.json()).toEqual({
      currency: 'usd',
      products: [
        { id: 'sticker', name: 'Loomgate sticker', unitAmount: 50 },
        { id: 'pin', name: 'Loomgate enamel pin', unitAmount: 75 },
      ],
    });
  });
});

describe('POST /api/checkout', () => {
  it('creates a payment intent priced by the server and returns its client secret', async () => {
    fetchMock.mockResolvedValue(Response.json(intent()));

    const res = await post('/api/checkout', checkoutBody);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      paymentIntentId: 'lg_pi_abc123',
      clientSecret: 'lg_cs_secret',
      amount: 100,
      currency: 'usd',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.loomgate.io/partner/v1/payment_intents');
    const headers = new Headers(init.headers);
    expect(headers.get('Authorization')).toBe(`Bearer ${env.LOOMGATE_SECRET_KEY}`);
    const body = JSON.parse(String(init.body));
    expect(headers.get('Idempotency-Key')).toBe(body.order_reference);
    expect(body).toMatchObject({
      amount: 100,
      currency: 'usd',
      items: [{ name: 'Loomgate sticker', quantity: 2, unit_amount: 50 }],
      buyer: { name: 'Jane Buyer' },
      shipping_details: {
        name: 'Jane Buyer',
        address: { line1: '1 Market St', city: 'San Francisco', state: 'CA', postal_code: '94105', country: 'US' },
      },
    });
    expect(body.order_reference).toMatch(/^order_/);
  });

  it('ignores an amount sent by the browser', async () => {
    fetchMock.mockResolvedValue(Response.json(intent()));
    await post('/api/checkout', { ...checkoutBody, amount: 1 });
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body));
    expect(body.amount).toBe(100);
  });

  it('uses LOOMGATE_API_BASE_URL when set', async () => {
    fetchMock.mockResolvedValue(Response.json(intent()));
    await app.request(
      '/api/checkout',
      { method: 'POST', body: JSON.stringify(checkoutBody) },
      { ...env, LOOMGATE_API_BASE_URL: 'http://localhost:4000' },
    );
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe('http://localhost:4000/partner/v1/payment_intents');
  });

  it.each([
    ['no cart', { ...checkoutBody, cart: undefined }],
    ['an unknown product', { ...checkoutBody, cart: [{ id: 'laptop', quantity: 1 }] }],
    ['no name', { ...checkoutBody, customer: { name: '  ' } }],
    ['no address line', { ...checkoutBody, shipping: { ...checkoutBody.shipping, line1: '' } }],
    ['a bad country', { ...checkoutBody, shipping: { ...checkoutBody.shipping, country: 'USA' } }],
  ])('rejects a request with %s without calling Loomgate', async (_, body) => {
    const res = await post('/api/checkout', body);
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'invalid_request' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects a body that is not JSON', async () => {
    const res = await app.request('/api/checkout', { method: 'POST', body: 'not json' }, env);
    expect(res.status).toBe(400);
  });

  it('hides Loomgate errors from the buyer and logs them', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { error: { type: 'invalid_request_error', code: 'amount_too_small', message: 'Amount too small.' } },
        { status: 400 },
      ),
    );
    const res = await post('/api/checkout', checkoutBody);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: { code: 'payment_unavailable', message: 'We could not start the payment. Please try again.' },
    });
    expect(console.error).toHaveBeenCalled();
  });
});

describe('GET /api/orders/:paymentIntentId', () => {
  it('returns the payment status', async () => {
    fetchMock.mockResolvedValue(Response.json(intent({ status: 'succeeded' })));
    const res = await app.request('/api/orders/lg_pi_abc123', {}, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      id: 'lg_pi_abc123',
      status: 'succeeded',
      amountTotal: 100,
      currency: 'usd',
      orderReference: 'order_1',
    });
    expect((fetchMock.mock.calls[0] as [string])[0]).toBe(
      'https://api.loomgate.io/partner/v1/payment_intents/lg_pi_abc123',
    );
  });

  it('rejects an id that is not a payment intent id', async () => {
    const res = await app.request('/api/orders/..%2Fbalance', {}, env);
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('tells the buyer the order could not be loaded when Loomgate fails', async () => {
    fetchMock.mockResolvedValue(Response.json({ error: { type: 'api_error', code: 'api_error' } }, { status: 500 }));
    const res = await app.request('/api/orders/lg_pi_abc123', {}, env);
    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: { code: 'payment_unavailable', message: 'We could not load your order. Please try again.' },
    });
  });

  it('answers 404 for an unknown payment intent', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        { error: { type: 'invalid_request_error', code: 'payment_intent_not_found', message: 'Not found.' } },
        { status: 404 },
      ),
    );
    const res = await app.request('/api/orders/lg_pi_missing', {}, env);
    expect(res.status).toBe(404);
  });
});
