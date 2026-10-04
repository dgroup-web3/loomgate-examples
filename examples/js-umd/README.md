# Loomgate checkout: browser build from jsDelivr (no bundler)

The same page as [js-cdn](../js-cdn), but the SDK comes from npm through jsDelivr, **pinned to one version** and
protected by [Subresource Integrity](https://developer.mozilla.org/docs/Web/Security/Subresource_Integrity). Use it
when you want to choose when the SDK changes.

```html
<script
  src="https://cdn.jsdelivr.net/npm/@loompay/loomgate-js-sdk@0.1.0/dist/loomgate.js"
  integrity="sha384-UjocyAWeTk1crAMkrV204wawBYiLCSvt0wUxO4xkwBOXwed7N9zOMrvzy0bvzEsK"
  crossorigin="anonymous"
></script>
<script type="module">
  // Loaded from jsDelivr, the script cannot tell which API to use: pass apiBaseUrl.
  const loomgate = await window.Loomgate.loadLoomgate('pk_live_…', { apiBaseUrl: 'https://api.loomgate.io' });
</script>
```

When you upgrade, change the version and the hash together:

```bash
curl -s https://cdn.jsdelivr.net/npm/@loompay/loomgate-js-sdk@VERSION/dist/loomgate.js | openssl dgst -sha384 -binary | openssl base64 -A
```

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

## Learn more

- Docs: [Checkout form (loomgate.js)](https://docs.loomgate.io/en/integrations/browser), [Node.js server](https://docs.loomgate.io/en/integrations/node-server), [webhooks](https://docs.loomgate.io/en/webhooks/webhook-endpoints) and the [API reference](https://docs.loomgate.io/en/api-reference)
  (also at [hk0-6.gitbook.io/loomgate/en](https://hk0-6.gitbook.io/loomgate/en)).
- Keys, webhooks and Apple Pay / Google Pay domains: the [merchant dashboard](https://app.loomgate.io).
- Try the API step by step with your own keys: the [playground](https://examples.loomgate.io).
