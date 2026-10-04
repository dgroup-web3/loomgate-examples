/**
 * The code shown next to each step: what a shop does to get the same result. Values the developer typed are filled in;
 * the secret key never is (it belongs in the server's environment). Full, runnable versions live in examples/*.
 */
export interface Snippet {
  label: string;
  language: 'typescript' | 'javascript' | 'xml' | 'tsx';
  code: string;
}

const json = (value: unknown) => JSON.stringify(value, null, 2).replace(/\n/g, '\n  ');

const SERVER_CLIENT = `import { createLoomgateServerClient } from '@loompay/loomgate-js-sdk/server';

// On your server only. Never send the secret key to a browser.
const loomgate = createLoomgateServerClient(process.env.LOOMGATE_SECRET_KEY);`;

export function orderSnippets(params: unknown): Snippet[] {
  return [
    {
      label: 'Server',
      language: 'typescript',
      code: `${SERVER_CLIENT}

// Build the body from YOUR cart and database. Never trust an amount sent by the browser.
// Amounts are in the smallest currency unit: 1250 = $12.50.
const intent = await loomgate.paymentIntents.create(
  ${json(params ?? { amount: 1250, currency: 'usd', items: [{ name: 'Mug', quantity: 1, unit_amount: 1250 }] })},
  // Your order id: a retry with the same key returns the same payment intent.
  { idempotencyKey: order.id },
);

// Send only intent.client_secret (lg_cs_…) to the page. It is returned once, on create.
return { clientSecret: intent.client_secret };`,
    },
  ];
}

export function feeQuoteSnippets(amount: number, currency: string): Snippet[] {
  return [
    {
      label: 'Server',
      language: 'typescript',
      code: `${SERVER_CLIENT}

const quote = await loomgate.feeQuotes.create({ amount: ${amount}, currency: '${currency}' });

quote.fee_bearer;     // 'merchant': fees come out of what you receive
                      // 'buyer':    fees are added to what the buyer pays (quote.fee_buyer)
quote.amount_total;   // what the card will be charged
quote.label;          // the name of the buyer's fee line, when the buyer pays the fees

const youReceive = quote.amount_total - quote.processing_fee - quote.bank_fee;`,
    },
  ];
}

export function paySnippets(publishableKey: string): Snippet[] {
  const pk = publishableKey.startsWith('pk_') ? publishableKey : 'pk_live_…';
  return [
    {
      label: 'JavaScript',
      language: 'javascript',
      code: `import { loadLoomgate } from '@loompay/loomgate-js-sdk';

// <div id="loomgate-payment"></div>
// <div id="loomgate-branding"></div>   required
// <button id="pay" disabled>Pay</button>

const loomgate = await loadLoomgate('${pk}');
const { clientSecret } = await fetch('/api/checkout', { method: 'POST', body: cart }).then((r) => r.json());

const session = loomgate.payment({ clientSecret });
session.on('change', ({ complete, amountTotal, currency }) => {
  payButton.disabled = !complete; // show amountTotal: it is what the card is charged
});
await session.mount({ payment: '#loomgate-payment', branding: '#loomgate-branding' });

payButton.addEventListener('click', () => {
  // No await before confirm(): wallets need the click's user activation.
  session.confirm({ billingDetails }).then((result) => {
    if (result.error) return showError(result.error.message); // safe to show
    // 'succeeded' or 'processing' — 'processing' is not paid yet.
    location.assign(\`/order?payment_intent=\${result.paymentIntentId}\`);
  });
});`,
    },
    {
      label: 'React',
      language: 'tsx',
      code: `import {
  BrandingElement, LoomgatePayment, LoomgateProvider, PaymentElement, loadLoomgate, useLoomgatePayment,
} from '@loompay/loomgate-react-sdk';

// Once, at module scope.
const loomgatePromise = loadLoomgate('${pk}');

function Checkout({ clientSecret }: { clientSecret: string }) {
  return (
    <LoomgateProvider loomgate={loomgatePromise}>
      <LoomgatePayment clientSecret={clientSecret}>
        <PaymentElement />
        <PayButton />
        <BrandingElement /> {/* required */}
      </LoomgatePayment>
    </LoomgateProvider>
  );
}

function PayButton() {
  const { canConfirm, confirm, amountTotal, currency } = useLoomgatePayment();
  return (
    <button
      disabled={!canConfirm}
      // No await before confirm(): wallets need the click's user activation.
      onClick={() => confirm({ billingDetails }).then((result) => { /* … */ })}
    >
      Pay {amountTotal !== null && formatAmount(amountTotal, currency)}
    </button>
  );
}`,
    },
    {
      label: 'HTML (no bundler)',
      language: 'xml',
      code: `<div id="loomgate-payment"></div>
<div id="loomgate-branding"></div>
<button id="pay" disabled>Pay</button>

<!-- Sets window.Loomgate. Same API as the npm package. -->
<script src="https://api.loomgate.io/partner/v1/loomgate.js"></script>
<script type="module">
  const loomgate = await window.Loomgate.loadLoomgate('${pk}');
  const session = loomgate.payment({ clientSecret });
  await session.mount({ payment: '#loomgate-payment', branding: '#loomgate-branding' });
</script>`,
    },
  ];
}

export function resultSnippets(paymentIntentId: string | null): Snippet[] {
  return [
    {
      label: 'Server',
      language: 'typescript',
      code: `${SERVER_CLIENT}

const intent = await loomgate.paymentIntents.retrieve('${paymentIntentId ?? 'lg_pi_…'}');

intent.status;             // 'succeeded' = paid. 'processing' is not paid yet.
intent.amount_total;       // charged to the card
intent.processing_fee;     // + intent.bank_fee: the fees, paid by intent.fee_bearer
intent.amount_refundable;  // what a refund can still return
intent.unlock_schedule;    // when the money becomes available to you, step by step

// In production, fulfil the order when your webhook endpoint receives
// \`payment_intent.succeeded\` (set it up in the merchant dashboard).`,
    },
  ];
}

export function refundSnippets(paymentIntentId: string | null, amount: number | null): Snippet[] {
  return [
    {
      label: 'Server',
      language: 'typescript',
      code: `${SERVER_CLIENT}

const refund = await loomgate.refunds.create(
  { payment_intent: '${paymentIntentId ?? 'lg_pi_…'}', amount: ${amount ?? 'undefined /* everything refundable */'} },
  // One key per refund. Store it before calling and reuse it on retries:
  // the same refund is never created twice.
  { idempotencyKey: refundRequest.id },
);

refund.status;      // 'pending' → 'succeeded' or 'failed' (webhooks refund.succeeded / refund.failed)
refund.refund_fee;  // charged to you; processing and bank fees are never returned`,
    },
  ];
}
