/**
 * Checkout layouts for step 3: the same payment, arranged and styled in different ways.
 *
 * What a shop can style:
 *   - its own page: billing fields, the Pay button, the panel around the card form (plain CSS);
 *   - the card form, which lives in a frame that page CSS cannot reach: through `appearance` in loadLoomgate()
 *     (`theme`, `variables`, `classes` per part, e.g. `whop-CardFieldInput`);
 *   - the branding notice: only through `theme`. It has no style hooks, must stay visible and must sit with the form.
 */
import type { LoadLoomgateOptions } from '@loompay/loomgate-react-sdk';

export type Appearance = NonNullable<LoadLoomgateOptions['appearance']>;

export type LayoutId = 'stacked' | 'compact' | 'split' | 'dark';

export interface CheckoutLayout {
  id: LayoutId;
  label: string;
  description: string;
  appearance: Appearance;
  /** A short sketch of the page markup, shown next to the step. */
  markup: string;
}

function pageScheme(): 'light' | 'dark' {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

export function checkoutLayouts(): CheckoutLayout[] {
  const scheme = pageScheme();
  return [
    {
      id: 'stacked',
      label: 'Stacked',
      description: 'Billing fields, card form, Pay button and branding, one under the other. The default.',
      appearance: { theme: { appearance: scheme } },
      markup: `<BillingFields />
<PaymentElement />
<button>Pay $1.00</button>
<BrandingElement />`,
    },
    {
      id: 'compact',
      label: 'Compact card',
      description: 'The card form in a panel, a full-width Pay button and the branding right under it.',
      appearance: {
        theme: { appearance: scheme, accentColor: 'teal', grayColor: 'slate' },
        classes: {
          'whop-CardFieldInput': { borderRadius: '10px' },
          'whop-PaymentMethodRow': { borderRadius: '10px' },
        },
      },
      markup: `<section class="rounded-xl border p-4">
  <input type="email" placeholder="Email" />
  <PaymentElement />
  <details><summary>Billing address</summary>…</details>
  <button class="w-full h-11">🔒 Pay $1.00</button>
  <BrandingElement class="mx-auto" />
</section>`,
    },
    {
      id: 'split',
      label: 'Summary + payment',
      description: 'The order summary on the left, the payment on the right, as on a one-page checkout.',
      appearance: { theme: { appearance: scheme, accentColor: 'iris' } },
      markup: `<div class="@container"><div class="grid @xl:grid-cols-[2fr_3fr]">
  <aside>Order summary: items, shipping, total</aside>
  <section>
    <BillingFields />
    <PaymentElement />
    <button>Pay $1.00</button>
    <BrandingElement />
  </section>
</div></div>`,
    },
    {
      id: 'dark',
      label: 'Dark panel',
      description: 'A brand-coloured dark panel, whatever the page theme: the form uses its dark theme to match.',
      appearance: {
        theme: { appearance: 'dark', accentColor: 'sky', grayColor: 'slate' },
        classes: { 'whop-CardFieldInput': { borderRadius: '12px' } },
      },
      markup: `<section style="background:#05333E;color:#FAFAFF" class="rounded-2xl p-6">
  <h3>Pay securely</h3>
  <PaymentElement />
  <button class="rounded-full" style="background:#B9E4FF;color:#05333E">Pay $1.00</button>
  <BrandingElement />
</section>`,
    },
  ];
}
