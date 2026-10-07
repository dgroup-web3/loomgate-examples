/**
 * The code shown next to each step: what a shop does to get the same result. Values the developer typed are filled in;
 * the secret key never is (it belongs in the server's environment). Full, runnable versions live in examples/*.
 */
import type { Appearance, CheckoutLayout } from './layouts';
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

/** How the page mounts the layout's card form, in each flavour of the SDK. */
function formCode(layout: CheckoutLayout) {
  const { form } = layout;
  const options = form.kind === 'fields' ? {} : form.options;
  const entries = Object.entries(options).filter(([, value]) => value !== undefined);
  const jsOptions = entries.map(([key, value]) => `, ${key}: ${JSON.stringify(value).replace(/"/g, "'")}`).join('');
  const jsxProps = entries
    .map(([key, value]) =>
      value === true
        ? ` ${key}`
        : typeof value === 'string'
          ? ` ${key}="${value}"`
          : ` ${key}={${JSON.stringify(value).replace(/"/g, "'")}}`,
    )
    .join('');
  if (form.kind === 'fields') {
    return {
      html: `<div id="card-number"></div>
<div id="card-expiry"></div>
<div id="card-cvc"></div>
<div id="loomgate-branding"></div>   <!-- required -->`,
      mount: `session.mount({
  cardNumber: '#card-number',
  cardExpiry: '#card-expiry',
  cardCvc: '#card-cvc',
  branding: '#loomgate-branding',
})`,
      jsx: `<CardNumberElement />
        <CardExpiryElement />
        <CardCvcElement />`,
      imports: 'CardCvcElement, CardExpiryElement, CardNumberElement',
    };
  }
  if (form.kind === 'card') {
    return {
      html: `<div id="loomgate-card"></div>
<div id="loomgate-branding"></div>   <!-- required -->`,
      mount: `session.mount({ card: '#loomgate-card', branding: '#loomgate-branding'${jsOptions} })`,
      jsx: `<CardElement${jsxProps} />`,
      imports: 'CardElement',
    };
  }
  return {
    html: `<div id="loomgate-payment"></div>
<div id="loomgate-branding"></div>   <!-- required -->`,
    mount: `session.mount({ payment: '#loomgate-payment', branding: '#loomgate-branding'${jsOptions} })`,
    jsx: `<PaymentElement${jsxProps} />`,
    imports: 'PaymentElement',
  };
}

export function paySnippets(publishableKey: string, layout: CheckoutLayout, appearance: Appearance): Snippet[] {
  const pk = publishableKey.startsWith('pk_') ? publishableKey : 'pk_live_…';
  // The card form's look: here for every form of the page. One payment can override it (loomgate.payment({ appearance })).
  const options = `{\n  appearance: ${JSON.stringify(appearance, null, 2).replace(/\n/g, '\n  ')},\n}`;
  const form = formCode(layout);
  return [
    {
      label: 'JavaScript',
      language: 'javascript',
      code: `import { loadLoomgate } from '@loompay/loomgate-js-sdk';

${form.html.replace(/^/gm, '// ')}
// <button id="pay" disabled>Pay</button>

const loomgate = await loadLoomgate('${pk}', ${options});
const { clientSecret } = await fetch('/api/checkout', { method: 'POST', body: cart }).then((r) => r.json());

const session = loomgate.payment({ clientSecret });
session.on('change', ({ complete, amountTotal, currency }) => {
  payButton.disabled = !complete; // show amountTotal: it is what the card is charged
});
await ${form.mount};

// Restyle it live, e.g. when the page switches to dark mode:
// session.update({ appearance: { theme: { appearance: 'dark' } } });

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
  BrandingElement, ${form.imports}, LoomgatePayment, LoomgateProvider, loadLoomgate, useLoomgatePayment,
} from '@loompay/loomgate-react-sdk';

// Once, at module scope.
const loomgatePromise = loadLoomgate('${pk}', ${options});

function Checkout({ clientSecret }: { clientSecret: string }) {
  return (
    <LoomgateProvider loomgate={loomgatePromise}>
      {/* appearance={…} here restyles this payment's form live */}
      <LoomgatePayment clientSecret={clientSecret}>
        ${form.jsx}
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
      code: `${form.html}
<button id="pay" disabled>Pay</button>

<!-- Sets window.Loomgate. Same API as the npm package. -->
<script src="https://api.loomgate.io/partner/v1/loomgate.js"></script>
<script type="module">
  const loomgate = await window.Loomgate.loadLoomgate('${pk}', ${options.replace(/\n/g, '\n  ')});
  const session = loomgate.payment({ clientSecret });
  await ${form.mount.replace(/\n/g, '\n  ')};
</script>`,
    },
    stylingSnippet(layout),
  ];
}

function stylingSnippet(layout: CheckoutLayout): Snippet {
  return {
    label: 'Styling',
    language: 'xml',
    code: `<!-- Layout "${layout.label}". Your page: style it with your own CSS. -->
${layout.markup}

<!--
  Pick the card form:
    payment form   <PaymentElement> / mount({ payment })      methods (card, Apple Pay, Google Pay) + card fields
                   layout "accordion" | "horizontal", separated, order, autoSelect
    card form      <CardElement> / mount({ card })            card fields only, layout "stacked" | "compact"
    card fields    <CardNumberElement> <CardExpiryElement> <CardCvcElement> / mount({ cardNumber, cardExpiry, cardCvc })

  The card form is in a frame your CSS cannot reach. Style it with \`appearance\`
  (loadLoomgate() for every form, <LoomgatePayment appearance> / session.update() for one, live):
    theme      appearance "light" | "dark", accentColor ("teal", "iris", "sky"…), grayColor
    classes    styles per part: CardFieldInput, CardFieldInputFocused, CardFieldInputInvalid,
               CardFieldError, PaymentMethodRow, PaymentMethodRowSelected, PaymentMethodTile…
    variables  CSS custom properties ("--name": "value")
  The branding notice has no style hooks: it follows the theme, must stay visible, and must be
  mounted with the card form. The Pay button is yours: style it freely.
-->`,
  };
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
