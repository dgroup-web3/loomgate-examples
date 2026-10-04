# Loomgate examples

Working examples of a [Loomgate](https://loomgate.io) card checkout, and a playground to try the API with your own
account. Copy the example that matches your stack into your project.

English · [Tiếng Việt](./README.vi.md)

| Folder | What it shows | Browser side | Server side |
|---|---|---|---|
| [`examples/js`](./examples/js) | JavaScript SDK from npm, no framework | `@loompay/loomgate-js-sdk` + Vite | Cloudflare Worker |
| [`examples/js-cdn`](./examples/js-cdn) | Hosted script, no bundler (**recommended** without a bundler) | `<script src="https://api.loomgate.io/partner/v1/loomgate.js">` | Cloudflare Worker |
| [`examples/js-umd`](./examples/js-umd) | Browser build from jsDelivr, pinned version with SRI | `<script src="https://cdn.jsdelivr.net/npm/@loompay/loomgate-js-sdk@0.1.0/dist/loomgate.js">` | Cloudflare Worker |
| [`examples/react`](./examples/react) | React SDK with shadcn/ui | `@loompay/loomgate-react-sdk` | Cloudflare Worker |
| [`apps/playground`](./apps/playground) | Fee quote, payment, fee breakdown and refund with **your** keys, with the code of each step | React SDK | Proxy Worker |

> [!WARNING]
> **There is no test mode.** Every payment made with these examples charges a real card and pays the merchant whose
> keys you use. Fees are not refunded. Use small amounts (Loomgate's minimum is $1.00 / €1.00, and the amount must be more than the fees when you bear them) and refund from the merchant
> dashboard.

## How a payment works

```
Browser                         Your server                         Loomgate
───────                         ───────────                         ────────
cart, shipping address  ──►  price the cart from YOUR catalog
                             paymentIntents.create(secret key) ──►  payment intent (lg_pi_…)
                        ◄──  client_secret (lg_cs_…)           ◄──
mount the card form (publishable key + client secret)
confirm() on "Pay"      ─────────────────────────────────────────►  charges the card
order page              ──►  paymentIntents.retrieve(id)       ──►  status: succeeded
```

- The **secret key** (`sk_live_…`) stays on your server. The **publishable key** (`pk_live_…`) and the client secret
  are safe in the browser.
- The server decides the amount. The browser only says what is in the cart.
- `processing` is not paid yet. Fulfil an order when the status is `succeeded`, or better, when your webhook endpoint
  receives `payment_intent.succeeded` (configure it in the merchant dashboard).

## Run an example

You need Node.js 20.19 or newer, [pnpm](https://pnpm.io), and the keys of a Loomgate merchant account (merchant
dashboard → API keys).

```bash
pnpm install
cd examples/react            # or js, js-cdn, js-umd
cp .dev.vars.example .dev.vars
# put your keys in .dev.vars
pnpm dev
```

Then open the URL printed in the terminal. Each app has its own port, so several can run at once: playground
`5180`, `js` `5181`, `react` `5182`, `js-cdn` `5183`, `js-umd` `5184`. Each example's README explains its files.

### Deploy to Cloudflare

```bash
pnpm exec wrangler secret put LOOMGATE_SECRET_KEY
pnpm exec wrangler secret put LOOMGATE_PUBLISHABLE_KEY
pnpm run deploy
```

### Not on Cloudflare?

The server part of every example is a small [Hono](https://hono.dev) app (`worker/index.ts`) that only uses the
Loomgate server SDK and web-standard APIs. It runs on Node.js 18+ as is, for example with `@hono/node-server`:

```ts
import { serve } from '@hono/node-server';
import app from './worker/index';

serve({ fetch: (request) => app.fetch(request, process.env), port: 3000 });
```

Any other framework works the same way: create the payment intent with `createLoomgateServerClient(secretKey)` and
return `client_secret` to the page.

## Playground

The playground (`apps/playground`) lets a developer try the API with their own merchant keys, step by step:

1. **Create an order**: items, shipping, tax, discount, buyer, shipping address.
2. **Preview the fees**: `POST /partner/v1/fee_quotes`. Nothing is charged.
3. **Pay**: create the payment intent, then pay with a real card in the React SDK card form. Pick one of four
   layouts to see what you can style: your page and Pay button freely, the card form through `appearance`
   (`theme`, `variables`, `classes`), the branding notice only through the theme.
4. **See the result**: status, what the card was charged, the processing and bank fees, what you receive, and when
   the money becomes available.
5. **Refund**: all or part of what is refundable.

Each step shows the matching code and the raw JSON exchanged with Loomgate.

> [!CAUTION]
> In the playground the secret key is typed in the page and sent with each request to the playground's server, which
> calls Loomgate with it and never stores or logs it. **That is only acceptable for a testing tool.** In a shop the
> secret key lives on your server, as in `examples/*`. Roll your key in the dashboard after testing.

Keys are kept in `sessionStorage` (gone when the tab closes), or in `localStorage` if you tick "Remember on this
device".

To keep your secret key on your own machine, run the playground locally:

```bash
pnpm install
pnpm --filter loomgate-playground dev
```

It needs no `.dev.vars`. Its server only forwards a fixed list of endpoints (`payment_intents` and `refunds` create and
retrieve, `fee_quotes`) to `https://api.loomgate.io`, limits each IP address to 60 requests per minute, and refuses
bodies over 64 KB.

## Before you go live

- [ ] The amount comes from your server, never from the browser.
- [ ] `order_reference` is your order id, and you pass it as the idempotency key when creating the payment intent.
- [ ] Orders are fulfilled on the `payment_intent.succeeded` webhook (verify it with `verifyWebhook` from
      `@loompay/loomgate-js-sdk/server`), not on the redirect.
- [ ] The branding element is mounted and visible: the card form refuses to confirm without it.
- [ ] Your privacy policy says that the card form collects device information to detect fraud (see the
      [JavaScript SDK README](https://www.npmjs.com/package/@loompay/loomgate-js-sdk#device-information)).
- [ ] If your site sets a Content Security Policy, allow what the
      [SDK README](https://www.npmjs.com/package/@loompay/loomgate-js-sdk#content-security-policy) lists.
- [ ] Apple Pay and Google Pay: verify your domain in the merchant dashboard (Wallet domains).

## Development of this repository

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm lint      # Biome, and a check that the files shared by the examples are still identical
pnpm build
```

Each example is self-contained, so a few files are duplicated (`worker/*`, `public/style.css`…). Edit them in
`examples/js` first, then copy them; `pnpm lint` fails when the copies differ.

## License

The examples are [MIT](./LICENSE) licensed: copy them freely. The Loomgate SDKs they use are published on npm under
their own license.
