# Loomgate checkout: React SDK

A checkout page with `@loompay/loomgate-react-sdk`, [shadcn/ui](https://ui.shadcn.com) and Tailwind CSS. The server
is a Cloudflare Worker.

> There is no test mode: payments made here are real.

```bash
pnpm install
cp .dev.vars.example .dev.vars   # then add your keys
pnpm dev
```

## Files

| File | What it does |
|---|---|
| `worker/index.ts` | The server: `GET /api/config`, `GET /api/products`, `POST /api/checkout` (prices the cart and creates the payment intent), `GET /api/orders/:id` |
| `worker/catalog.ts` | The product catalog and cart pricing. Replace it with your database |
| `.dev.vars.example` | The keys the server needs. Copy to `.dev.vars` |
| `src/lib/loomgate.ts` | `loadLoomgate()` called **once**, at module scope, as `<LoomgateProvider>` requires |
| `src/components/PaymentForm.tsx` | `<LoomgateProvider>`, `<LoomgatePayment>`, `<PaymentElement>`, `<BrandingElement>` and the Pay button (`useLoomgatePayment`) |
| `src/pages/CheckoutPage.tsx` | Cart and shipping form, asks the server for a payment intent |
| `src/pages/OrderPage.tsx` | Shows the payment status after paying |
| `src/components/ui/` | shadcn/ui components |

Next.js: the React SDK ships the `"use client"` directive. Call `loadLoomgate()` only in the browser
(`typeof window === 'undefined' ? null : loadLoomgate(…)`), and create the payment intent in a Route Handler or a
Server Action with `@loompay/loomgate-js-sdk/server`.

Deploy: `pnpm exec wrangler secret put LOOMGATE_SECRET_KEY`, the same for `LOOMGATE_PUBLISHABLE_KEY`, then
`pnpm run deploy`.
