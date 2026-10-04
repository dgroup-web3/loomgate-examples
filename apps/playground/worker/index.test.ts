import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import app, { type Env } from './index';

const SECRET = 'sk_live_test_fixture_not_a_real_key';

let fetchMock: ReturnType<typeof vi.fn>;
type Limit = (options: { key: string }) => Promise<{ success: boolean }>;
let limit: ReturnType<typeof vi.fn<Limit>>;
let env: Env;

beforeEach(() => {
  fetchMock = vi.fn().mockResolvedValue(Response.json({ id: 'lg_pi_abc', object: 'payment_intent' }));
  vi.stubGlobal('fetch', fetchMock);
  limit = vi.fn<Limit>().mockResolvedValue({ success: true });
  env = { RATE_LIMITER: { limit } };
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  return app.request(
    path,
    {
      method,
      headers: { 'X-Loomgate-Secret-Key': SECRET, 'CF-Connecting-IP': '203.0.113.7', ...headers },
      ...(body === undefined ? {} : { body: typeof body === 'string' ? body : JSON.stringify(body) }),
    },
    env,
  );
}

function sent(index = 0) {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url, init, headers: new Headers(init.headers), body: init.body ? JSON.parse(String(init.body)) : undefined };
}

describe('GET /api/config', () => {
  it('returns the API base URL, defaulting to production', async () => {
    const res = await app.request('/api/config', {}, env);
    expect(await res.json()).toEqual({ apiBaseUrl: 'https://api.loomgate.io' });
  });

  it('uses LOOMGATE_API_BASE_URL when set (local development only)', async () => {
    const res = await app.request('/api/config', {}, { ...env, LOOMGATE_API_BASE_URL: 'http://localhost:4000' });
    expect(await res.json()).toEqual({ apiBaseUrl: 'http://localhost:4000' });
  });
});

describe('the secret key', () => {
  it('is required', async () => {
    const res = await app.request('/api/fee_quotes', { method: 'POST', body: '{}' }, env);
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: { code: 'secret_key_missing' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is forwarded to Loomgate as the bearer token', async () => {
    await call('POST', '/api/fee_quotes', { amount: 1000, currency: 'usd' });
    expect(sent().headers.get('Authorization')).toBe(`Bearer ${SECRET}`);
  });

  it('is never logged', async () => {
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((level) =>
      vi.spyOn(console, level).mockImplementation(() => {}),
    );
    fetchMock.mockRejectedValue(new TypeError('network down'));
    await call('POST', '/api/fee_quotes', { amount: 1000, currency: 'usd' });
    for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toContain(SECRET);
  });

  it('rejects a key that is not a secret key without calling Loomgate', async () => {
    const res = await call(
      'POST',
      '/api/fee_quotes',
      { amount: 1000, currency: 'usd' },
      {
        'X-Loomgate-Secret-Key': 'pk_live_test_fixture_not_a_real_key',
      },
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: { code: 'invalid_api_key' } });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/payment_intents', () => {
  it('forwards only the payment intent fields and the idempotency key', async () => {
    const body = {
      amount: 1250,
      currency: 'usd',
      items: [{ name: 'Mug', quantity: 1, unit_amount: 1250 }],
      buyer: { name: 'Jane' },
      order_reference: 'A-1',
      shipping_details: { name: 'Jane', address: { line1: '1 Main St', country: 'US' } },
      metadata: { cart: '42' },
      hacker: 'ignored',
    };
    const res = await call('POST', '/api/payment_intents', body, { 'Idempotency-Key': 'playground-1' });
    expect(res.status).toBe(200);
    const request = sent();
    expect(request.url).toBe('https://api.loomgate.io/partner/v1/payment_intents');
    expect(request.headers.get('Idempotency-Key')).toBe('playground-1');
    const { hacker: _hacker, ...expected } = body;
    expect(request.body).toEqual(expected);
  });

  it('rejects a body that is not a JSON object', async () => {
    const res = await call('POST', '/api/payment_intents', 'nope');
    expect(res.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('GET /api/payment_intents/:id', () => {
  it('retrieves the payment intent', async () => {
    const res = await call('GET', '/api/payment_intents/lg_pi_abc');
    expect(res.status).toBe(200);
    expect(sent().url).toBe('https://api.loomgate.io/partner/v1/payment_intents/lg_pi_abc');
  });

  it('refuses anything but a payment intent id', async () => {
    const res = await call('GET', '/api/payment_intents/..%2Fbalance');
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/fee_quotes', () => {
  it('forwards amount and currency only', async () => {
    await call('POST', '/api/fee_quotes', { amount: 1000, currency: 'eur', extra: 1 });
    expect(sent().url).toBe('https://api.loomgate.io/partner/v1/fee_quotes');
    expect(sent().body).toEqual({ amount: 1000, currency: 'eur' });
  });
});

describe('POST /api/refunds', () => {
  it('forwards the refund fields and the idempotency key', async () => {
    await call(
      'POST',
      '/api/refunds',
      { payment_intent: 'lg_pi_abc', amount: 100, reason: 'test' },
      {
        'Idempotency-Key': 'refund-1',
      },
    );
    expect(sent().url).toBe('https://api.loomgate.io/partner/v1/refunds');
    expect(sent().headers.get('Idempotency-Key')).toBe('refund-1');
    expect(sent().body).toEqual({ payment_intent: 'lg_pi_abc', amount: 100, reason: 'test' });
  });
});

describe('GET /api/refunds/:id', () => {
  it('retrieves the refund', async () => {
    const res = await call('GET', '/api/refunds/lg_re_abc');
    expect(res.status).toBe(200);
    expect(sent().url).toBe('https://api.loomgate.io/partner/v1/refunds/lg_re_abc');
  });

  it('refuses anything but a refund id', async () => {
    const res = await call('GET', '/api/refunds/lg_pi_abc');
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('only the listed endpoints are proxied', () => {
  it.each([
    ['GET', '/api/balance'],
    ['GET', '/api/payment_intents'],
    ['POST', '/api/payment_intents/lg_pi_abc'],
    ['POST', '/api/payment_intents/lg_pi_abc/confirm'],
    ['GET', '/api/webhook_signing_keys'],
    ['GET', '/api/https://evil.example/'],
  ])('%s %s → 404', async (method, path) => {
    const res = await call(method, path, method === 'POST' ? {} : undefined);
    expect(res.status).toBe(404);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('Loomgate errors', () => {
  it('pass through with their status, type, code and param', async () => {
    fetchMock.mockResolvedValue(
      Response.json(
        {
          error: {
            type: 'invalid_request_error',
            code: 'payment_details_missing',
            message: 'Missing buyer.',
            param: 'buyer',
          },
        },
        { status: 400 },
      ),
    );
    const res = await call('POST', '/api/payment_intents', { amount: 50, currency: 'usd' });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        type: 'invalid_request_error',
        code: 'payment_details_missing',
        message: 'Missing buyer.',
        param: 'buyer',
      },
    });
  });

  it('answer 502 when Loomgate cannot be reached', async () => {
    fetchMock.mockRejectedValue(new TypeError('network down'));
    const res = await call('POST', '/api/fee_quotes', { amount: 1000, currency: 'usd' });
    expect(res.status).toBe(502);
    expect(await res.json()).toMatchObject({ error: { code: 'network_error' } });
  });
});

describe('rate limiting', () => {
  it('limits by client IP', async () => {
    await call('POST', '/api/fee_quotes', { amount: 1000, currency: 'usd' });
    expect(limit).toHaveBeenCalledWith({ key: '203.0.113.7' });
  });

  it('answers 429 when the limit is reached, without calling Loomgate', async () => {
    limit.mockResolvedValue({ success: false });
    const res = await call('POST', '/api/fee_quotes', { amount: 1000, currency: 'usd' });
    expect(res.status).toBe(429);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('announces the policy', async () => {
    const res = await call('POST', '/api/fee_quotes', { amount: 1000, currency: 'usd' });
    expect(res.headers.get('RateLimit-Policy')).toBe('60;w=60');
  });

  it('is skipped when no limiter is bound (local development)', async () => {
    const res = await app.request(
      '/api/fee_quotes',
      {
        method: 'POST',
        body: JSON.stringify({ amount: 1000, currency: 'usd' }),
        headers: { 'X-Loomgate-Secret-Key': SECRET },
      },
      {},
    );
    expect(res.status).toBe(200);
  });
});

describe('responses', () => {
  it('are never cached', async () => {
    const res = await call('POST', '/api/fee_quotes', { amount: 1000, currency: 'usd' });
    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('refuse bodies over 64 KB', async () => {
    const res = await call('POST', '/api/payment_intents', { description: 'x'.repeat(70_000) });
    expect(res.status).toBe(413);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
