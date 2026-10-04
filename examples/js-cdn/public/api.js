// Calls to this shop's own server (worker/index.ts). The browser never talks to Loomgate with a secret key.

async function call(path, init) {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message ?? `Request failed (HTTP ${res.status}).`);
  return body;
}

/** @returns {Promise<{ publishableKey: string, apiBaseUrl: string }>} */
export const getConfig = () => call('/api/config');

/** @returns {Promise<{ currency: string, products: Array<{ id: string, name: string, unitAmount: number }> }>} */
export const getCatalog = () => call('/api/products');

/** @returns {Promise<{ id: string, status: string, amountTotal: number, currency: string, orderReference: string | null }>} */
export const getOrder = (paymentIntentId) => call(`/api/orders/${encodeURIComponent(paymentIntentId)}`);

/** @returns {Promise<{ paymentIntentId: string, clientSecret: string, amount: number, currency: string }>} */
export const startCheckout = (request) =>
  call('/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

/** 150, 'usd' → "$1.50". Amounts are in the smallest currency unit. */
export function formatAmount(amount, currency) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount / 100);
}
