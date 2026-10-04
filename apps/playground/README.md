# Loomgate playground

Try the Loomgate API with your own merchant keys: preview the fees, pay with a card, see the fee breakdown and refund,
with the code of each step. See [the main README](../../README.md#playground) for what it does and why the secret key
is handled the way it is.

```bash
pnpm install
pnpm dev
```

| File | What it does |
|---|---|
| `worker/index.ts` | The proxy: forwards a fixed list of endpoints to the Loomgate API with the key sent by the page. **Testing tool only** |
| `src/steps/*` | The five steps |
| `src/lib/order.ts` | Turns the order form into the body of `POST /partner/v1/payment_intents` |
| `src/lib/snippets.ts` | The code shown next to each step |

Deploy (examples.loomgate.io): add the custom domain in `wrangler.jsonc` or the Cloudflare dashboard, then
`pnpm run deploy`. No secrets are needed.
