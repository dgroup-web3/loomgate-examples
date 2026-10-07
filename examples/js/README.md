# Loomgate checkout: JavaScript SDK (npm)

A checkout page without a framework, using `@loompay/loomgate-js-sdk` from npm, bundled by Vite. The server is a
Cloudflare Worker.

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
| `src/checkout.ts` | Loads the SDK, asks the server for a payment intent, mounts the card form, confirms the payment |
| `src/order.ts` | Shows the payment status after paying (`processing` is checked again until it is final) |
| `index.html`, `order.html` | The two pages. `#loomgate-payment` and `#loomgate-branding` hold the card form and the required branding notice |

Deploy: `pnpm exec wrangler secret put LOOMGATE_SECRET_KEY`, the same for `LOOMGATE_PUBLISHABLE_KEY`, then
`pnpm run deploy`.

## Learn more

- Docs: [Checkout form (loomgate.js)](https://docs.loomgate.io/en/integrations/browser), [Node.js server](https://docs.loomgate.io/en/integrations/node-server), [webhooks](https://docs.loomgate.io/en/webhooks/setup) and the [API reference](https://docs.loomgate.io/en/api-reference/introduction).
- Keys, webhooks and Apple Pay / Google Pay domains: the [merchant dashboard](https://app.loomgate.io).
- Try the API step by step with your own keys: the [playground](https://examples.loomgate.io).
