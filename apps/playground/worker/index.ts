/**
 * The playground's server: a thin proxy from the page to the Loomgate API, so that developers can try the API with
 * their own keys.
 *
 * DO NOT COPY THIS PATTERN INTO A SHOP. Here the secret key comes from the browser (the developer typed it); in a real
 * integration it stays on your server, as in examples/*. This Worker:
 *   - never stores or logs the key: it is only used for the one request it came with;
 *   - forwards a fixed list of endpoints and fields, to a fixed API address (never one chosen by the browser);
 *   - limits each IP address (Workers Rate Limiting) and the size of request bodies.
 */
import { createLoomgateServerClient, LoomgateApiError } from '@loompay/loomgate-js-sdk/server';
import { type Context, Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

export interface Env {
  /** Optional, for local development against another API. Defaults to https://api.loomgate.io. */
  LOOMGATE_API_BASE_URL?: string;
  /** Workers Rate Limiting binding (wrangler.jsonc). Absent in tests. */
  RATE_LIMITER?: { limit(options: { key: string }): Promise<{ success: boolean }> };
}

type AppContext = Context<{ Bindings: Env }>;

const DEFAULT_API_BASE_URL = 'https://api.loomgate.io';
const SECRET_KEY_HEADER = 'X-Loomgate-Secret-Key';
const PAYMENT_INTENT_ID = /^lg_pi_[A-Za-z0-9]{1,64}$/;
const REFUND_ID = /^lg_re_[A-Za-z0-9]{1,64}$/;
const MAX_BODY_BYTES = 64 * 1024;

const PAYMENT_INTENT_FIELDS = [
  'amount',
  'currency',
  'items',
  'shipping_amount',
  'tax_amount',
  'discount_amount',
  'goods_type',
  'buyer',
  'order_reference',
  'shipping_details',
  'description',
  'metadata',
] as const;
const FEE_QUOTE_FIELDS = ['amount', 'currency'] as const;
const REFUND_FIELDS = ['payment_intent', 'amount', 'reason'] as const;

const app = new Hono<{ Bindings: Env }>();

app.use('/api/*', async (c, next) => {
  await next();
  c.res.headers.set('Cache-Control', 'no-store');
});

app.use('/api/*', async (c, next) => {
  const limiter = c.env.RATE_LIMITER;
  if (limiter) {
    const key = c.req.header('CF-Connecting-IP') ?? 'unknown';
    const { success } = await limiter.limit({ key });
    if (!success) return errorResponse(429, 'rate_limited', 'Too many requests. Wait a minute and try again.');
    await next();
    // Tells clients the policy (and shows that the limiter is bound).
    c.res.headers.set('RateLimit-Policy', '60;w=60');
    return;
  }
  await next();
});

app.use(
  '/api/*',
  bodyLimit({
    maxSize: MAX_BODY_BYTES,
    onError: () => errorResponse(413, 'body_too_large', 'The request body is larger than 64 KB.'),
  }),
);

function apiBaseUrl(env: Env): string {
  return env.LOOMGATE_API_BASE_URL?.trim() || DEFAULT_API_BASE_URL;
}

app.get('/api/config', (c) => c.json({ apiBaseUrl: apiBaseUrl(c.env) }));

app.post('/api/payment_intents', (c) =>
  withLoomgate(c, async (loomgate) => {
    const body = await jsonBody(c, PAYMENT_INTENT_FIELDS);
    if (!body) return invalidBody();
    const idempotencyKey = c.req.header('Idempotency-Key');
    return loomgate.paymentIntents.create(body as never, idempotencyKey ? { idempotencyKey } : undefined);
  }),
);

app.get('/api/payment_intents/:id', (c) => {
  const id = c.req.param('id');
  if (!PAYMENT_INTENT_ID.test(id)) return notFound();
  return withLoomgate(c, (loomgate) => loomgate.paymentIntents.retrieve(id));
});

app.post('/api/fee_quotes', (c) =>
  withLoomgate(c, async (loomgate) => {
    const body = await jsonBody(c, FEE_QUOTE_FIELDS);
    if (!body) return invalidBody();
    return loomgate.feeQuotes.create(body as never);
  }),
);

app.post('/api/refunds', (c) =>
  withLoomgate(c, async (loomgate) => {
    const body = await jsonBody(c, REFUND_FIELDS);
    if (!body) return invalidBody();
    const idempotencyKey = c.req.header('Idempotency-Key');
    return loomgate.refunds.create(body as never, idempotencyKey ? { idempotencyKey } : undefined);
  }),
);

app.get('/api/refunds/:id', (c) => {
  const id = c.req.param('id');
  if (!REFUND_ID.test(id)) return notFound();
  return withLoomgate(c, (loomgate) => loomgate.refunds.retrieve(id));
});

app.all('/api/*', () => notFound());

type Loomgate = ReturnType<typeof createLoomgateServerClient>;

/** Runs one Loomgate call with the key sent by the page, and turns its result or error into a response. */
async function withLoomgate(c: AppContext, run: (loomgate: Loomgate) => Promise<unknown>): Promise<Response> {
  const secretKey = c.req.header(SECRET_KEY_HEADER)?.trim();
  if (!secretKey) return errorResponse(401, 'secret_key_missing', 'Enter your secret key (sk_live_…) first.');
  try {
    const result = await run(createLoomgateServerClient(secretKey, { apiBaseUrl: apiBaseUrl(c.env) }));
    return result instanceof Response ? result : Response.json(result);
  } catch (error) {
    if (!(error instanceof LoomgateApiError)) throw error;
    // status 0: no answer from the API (bad key format caught by the SDK, network error, timeout).
    const status = error.status || (error.code === 'network_error' || error.code === 'request_timeout' ? 502 : 400);
    return Response.json(
      {
        error: {
          type: error.type,
          code: error.code,
          message: error.message,
          ...(error.param ? { param: error.param } : {}),
          ...(error.declineCode ? { decline_code: error.declineCode } : {}),
        },
      },
      { status },
    );
  }
}

/** The JSON object in the request, reduced to `fields`; null when the body is not a JSON object. */
async function jsonBody(c: AppContext, fields: readonly string[]): Promise<Record<string, unknown> | null> {
  const body: unknown = await c.req.json().catch(() => null);
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return null;
  const picked: Record<string, unknown> = {};
  for (const field of fields) {
    if (field in body) picked[field] = (body as Record<string, unknown>)[field];
  }
  return picked;
}

function errorResponse(status: number, code: string, message: string) {
  return Response.json({ error: { type: 'invalid_request_error', code, message } }, { status });
}

function invalidBody() {
  return errorResponse(400, 'invalid_body', 'Expected a JSON object.');
}

function notFound() {
  return errorResponse(404, 'not_found', 'This playground only proxies the endpoints it uses.');
}

export default app;
