/**
 * Calls from the page to the playground's Worker (worker/index.ts), which forwards them to the Loomgate API with the
 * secret key the developer typed. Every call returns the exchange too, so the page can show the raw JSON.
 */
import type {
  CreatePaymentIntentParams,
  CreateRefundParams,
  Currency,
  FeeQuote,
  PaymentIntent,
  Refund,
} from '@loompay/loomgate-js-sdk/server';

export type { FeeQuote, PaymentIntent, Refund };

export interface ApiError {
  type: string;
  code: string;
  message: string;
  param?: string;
  decline_code?: string;
}

export interface Exchange {
  /** As seen by Loomgate: `POST /partner/v1/payment_intents`. */
  request: string;
  requestBody?: unknown;
  status: number;
  responseBody: unknown;
}

export type ApiResult<T> =
  | { ok: true; data: T; exchange: Exchange }
  | { ok: false; error: ApiError; exchange: Exchange };

async function call<T>(
  secretKey: string,
  method: 'GET' | 'POST',
  path: string,
  body?: unknown,
  idempotencyKey?: string,
): Promise<ApiResult<T>> {
  const request = `${method} /partner/v1${path}`;
  const headers: Record<string, string> = { 'X-Loomgate-Secret-Key': secretKey };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;

  let res: Response;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    const error = { type: 'api_error', code: 'network_error', message: 'The playground server could not be reached.' };
    return { ok: false, error, exchange: { request, requestBody: body, status: 0, responseBody: { error } } };
  }
  const json: unknown = await res.json().catch(() => null);
  const exchange: Exchange = { request, requestBody: body, status: res.status, responseBody: json };
  if (res.ok) return { ok: true, data: json as T, exchange };
  const error = (json as { error?: ApiError } | null)?.error ?? {
    type: 'api_error',
    code: 'unexpected_response',
    message: `HTTP ${res.status}`,
  };
  return { ok: false, error, exchange };
}

export async function getConfig(): Promise<{ apiBaseUrl: string }> {
  const res = await fetch('/api/config');
  return res.json();
}

export const createPaymentIntent = (secretKey: string, params: CreatePaymentIntentParams, idempotencyKey: string) =>
  call<PaymentIntent>(secretKey, 'POST', '/payment_intents', params, idempotencyKey);

export const retrievePaymentIntent = (secretKey: string, id: string) =>
  call<PaymentIntent>(secretKey, 'GET', `/payment_intents/${encodeURIComponent(id)}`);

export const createFeeQuote = (secretKey: string, amount: number, currency: Currency) =>
  call<FeeQuote>(secretKey, 'POST', '/fee_quotes', { amount, currency });

export const retrieveRefund = (secretKey: string, id: string) =>
  call<Refund>(secretKey, 'GET', `/refunds/${encodeURIComponent(id)}`);

export const createRefund = (secretKey: string, params: CreateRefundParams, idempotencyKey: string) =>
  call<Refund>(secretKey, 'POST', '/refunds', params, idempotencyKey);
