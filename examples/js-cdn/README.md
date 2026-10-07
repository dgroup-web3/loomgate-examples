# Loomgate checkout: hosted script (no bundler)

The recommended setup without a bundler: one `<script>` tag loads the SDK from Loomgate and sets `window.Loomgate`.
The pages are plain HTML and JavaScript modules, served as they are. The server is a Cloudflare Worker.

```html
<script src="https://api.loomgate.io/partner/v1/loomgate.js"></script>
<script type="module">
  const loomgate = await window.Loomgate.loadLoomgate('pk_live_…');
</script>
```

The script always matches the API it is served by, and works out the API address from its own URL, so only the
publishable key is needed.

> There is no test mode: payments made here are real.

```bash
pnpm install
cp .dev.vars.example .dev.vars   # then add your keys
pnpm dev                          # wrangler dev
```

## Files

| File | What it does |
|---|---|
| `worker/index.ts` | The server: `GET /api/config`, `GET /api/products`, `POST /api/checkout` (prices the cart and creates the payment intent), `GET /api/orders/:id` |
| `worker/catalog.ts` | The product catalog and cart pricing. Replace it with your database |
| `.dev.vars.example` | The keys the server needs. Copy to `.dev.vars` |
| `public/checkout.js` | Loads the SDK, asks the server for a payment intent, mounts the card form, confirms the payment |
| `public/order.js` | Shows the payment status after paying |
| `public/index.html`, `public/order.html` | The two pages |

Deploy: `pnpm exec wrangler secret put LOOMGATE_SECRET_KEY`, the same for `LOOMGATE_PUBLISHABLE_KEY`, then
`pnpm run deploy`.

## Learn more

- Docs: [Checkout form (loomgate.js)](https://docs.loomgate.io/en/integrations/browser), [Node.js server](https://docs.loomgate.io/en/integrations/node-server), [webhooks](https://docs.loomgate.io/en/webhooks/setup) and the [API reference](https://docs.loomgate.io/en/api-reference/introduction).
- Keys, webhooks and Apple Pay / Google Pay domains: the [merchant dashboard](https://app.loomgate.io).
- Try the API step by step with your own keys: the [playground](https://examples.loomgate.io).
