/** Calls to this shop's own server (worker/index.ts). The browser never talks to Loomgate with a secret key. */

export interface Config {
  publishableKey: string;
  apiBaseUrl: string;
}

export interface Product {
  id: string;
  name: string;
  unitAmount: number;
}

export interface Catalog {
  currency: string;
  products: Product[];
}

export interface CheckoutRequest {
  cart: Array<{ id: string; quantity: number }>;
  customer: { name: string };
  shipping: { line1: string; line2: string; city: string; state: string; postal_code: string; country: string };
}

export interface Checkout {
  paymentIntentId: string;
  clientSecret: string;
  amount: number;
  currency: string;
}

export interface Order {
  id: string;
  status: 'pending' | 'processing' | 'succeeded' | 'canceled';
  amountTotal: number;
  currency: string;
  orderReference: string | null;
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? `Request failed (HTTP ${res.status}).`);
  return body as T;
}

export const getConfig = () => call<Config>('/api/config');
export const getCatalog = () => call<Catalog>('/api/products');
export const getOrder = (paymentIntentId: string) => call<Order>(`/api/orders/${encodeURIComponent(paymentIntentId)}`);
export const startCheckout = (request: CheckoutRequest) =>
  call<Checkout>('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

/** 150, 'usd' → "$1.50". Amounts are in the smallest currency unit. */
export function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
}
