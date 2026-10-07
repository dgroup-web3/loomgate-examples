/**
 * Checkout layouts for step 3: the same payment, with a different card form, arrangement and style.
 *
 * What a shop can style:
 *   - its own page: billing fields, the Pay button, the panel around the card form (plain CSS);
 *   - which card form: the payment form (payment methods + card fields), the card fields only, or the three card fields
 *     placed one by one; and its layout options (`layout`, `separated`, …);
 *   - the card form's look, which lives in a frame that page CSS cannot reach: through `appearance` (`theme`,
 *     `variables`, `classes` per part, e.g. `CardFieldInput`), for every form in loadLoomgate() or for one payment;
 *   - the branding notice: only through `theme`. It has no style hooks, must stay visible and must sit with the form.
 */
import type { Appearance, CardFormOptions, PaymentFormOptions } from '@loompay/loomgate-react-sdk';

export type { Appearance };

export type LayoutId = 'original' | 'stacked' | 'tiles' | 'compact' | 'fields' | 'summary' | 'dark';

/** The card form a layout mounts, with its layout options. */
export type CardFormChoice =
  | { kind: 'payment'; options: PaymentFormOptions }
  | { kind: 'card'; options: CardFormOptions }
  | { kind: 'fields' };

export interface CheckoutLayout {
  id: LayoutId;
  label: string;
  description: string;
  form: CardFormChoice;
  appearance: Appearance;
  /** No appearance at all, not even the page's colour scheme: the card form exactly as it comes. */
  original?: boolean;
  /** A short sketch of the page markup, shown next to the step. */
  markup: string;
}

export function checkoutLayouts(): CheckoutLayout[] {
  return [
    {
      id: 'original',
      label: 'Original (no styling)',
      description:
        'The card form exactly as it comes, with no appearance at all: the reference to compare the other samples with.',
      form: { kind: 'payment', options: {} },
      appearance: {},
      original: true,
      markup: `<BillingFields />
<PaymentElement />          {/* no appearance anywhere */}
<button>Pay $1.00</button>
<BrandingElement />`,
    },
    {
      id: 'stacked',
      label: 'Stacked',
      description: 'Billing fields, payment form, Pay button and branding, one under the other. The default.',
      form: { kind: 'payment', options: {} },
      appearance: {},
      markup: `<BillingFields />
<PaymentElement />
<button>Pay $1.00</button>
<BrandingElement />`,
    },
    {
      id: 'tiles',
      label: 'Method tiles',
      description:
        'The payment form with one tile per payment method (layout "horizontal"). With a single method, the card, it shows one tile.',
      form: { kind: 'payment', options: { layout: 'horizontal', order: ['apple_pay', 'google_pay', 'card'] } },
      appearance: {
        theme: { accentColor: 'iris' },
        classes: {
          PaymentMethodTile: { borderRadius: '12px' },
          PaymentMethodTileSelected: { borderWidth: '2px' },
          CardFieldInput: { borderRadius: '10px' },
        },
      },
      markup: `<BillingFields />
<PaymentElement layout="horizontal" order={['apple_pay', 'google_pay', 'card']} />
<button>Pay $1.00</button>
<BrandingElement />`,
    },
    {
      id: 'compact',
      label: 'Card in one row',
      description: 'The card fields only, on one row (layout "compact"), in a panel with a full-width Pay button.',
      form: { kind: 'card', options: { layout: 'compact' } },
      appearance: {
        theme: { accentColor: 'teal', grayColor: 'slate' },
        classes: { CardFieldInput: { borderRadius: '10px' } },
      },
      markup: `<section class="rounded-xl border p-4">
  <input type="email" placeholder="Email" />
  <CardElement layout="compact" />
  <details><summary>Billing address</summary>…</details>
  <button class="w-full h-11">🔒 Pay $1.00</button>
  <BrandingElement class="mx-auto" />
</section>`,
    },
    {
      id: 'fields',
      label: 'Separate card fields',
      description:
        'Card number, expiry and CVC placed one by one in your own grid, each with your own label, like the other fields of the form.',
      form: { kind: 'fields' },
      appearance: {
        theme: { accentColor: 'blue' },
        classes: {
          CardFieldInput: { borderRadius: '8px', fontSize: '15px' },
          CardFieldInputFocused: { boxShadow: '0 0 0 3px rgba(59, 130, 246, 0.25)' },
        },
      },
      markup: `<BillingFields />
<label>Card number</label>
<CardNumberElement />
<div class="grid grid-cols-2 gap-3">
  <div><label>Expiry</label><CardExpiryElement /></div>
  <div><label>CVC</label><CardCvcElement /></div>
</div>
<button>Pay $1.00</button>
<BrandingElement />`,
    },
    {
      id: 'summary',
      label: 'Summary + payment',
      description:
        'The order summary on the left, the payment on the right, as on a one-page checkout. Each payment method in its own card (separated).',
      form: { kind: 'payment', options: { separated: true } },
      appearance: { theme: { accentColor: 'iris' } },
      markup: `<div class="@container"><div class="grid @xl:grid-cols-[2fr_3fr]">
  <aside>Order summary: items, shipping, total</aside>
  <section>
    <BillingFields />
    <PaymentElement separated />
    <button>Pay $1.00</button>
    <BrandingElement />
  </section>
</div></div>`,
    },
    {
      id: 'dark',
      label: 'Dark panel',
      description: 'A brand-coloured dark panel, whatever the page theme: the form uses its dark theme to match.',
      form: { kind: 'payment', options: {} },
      appearance: {
        theme: { appearance: 'dark', accentColor: 'sky', grayColor: 'slate' },
        classes: { CardFieldInput: { borderRadius: '12px' } },
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

/** What the developer changes in the "Style" controls of step 3, on top of the layout's own appearance. */
export interface Customization {
  scheme: 'layout' | 'light' | 'dark';
  accentColor: 'layout' | NonNullable<NonNullable<Appearance['theme']>['accentColor']>;
  radius: 'layout' | 'square' | 'rounded' | 'round';
  fontSize: 'layout' | '14px' | '16px' | '18px';
  border: 'layout' | 'none' | 'thin' | 'thick' | 'dashed' | 'underline';
  /** A preset name, or `custom` for `customBorderColor`. */
  borderColor: 'layout' | keyof typeof BORDER_COLORS | 'custom';
  customBorderColor: string;
}

export const NO_CUSTOMIZATION: Customization = {
  scheme: 'layout',
  accentColor: 'layout',
  radius: 'layout',
  fontSize: 'layout',
  border: 'layout',
  borderColor: 'layout',
  customBorderColor: '#05333e',
};

/** Border colour presets of the "Style" controls. */
export const BORDER_COLORS = {
  brand: { label: 'Brand (#05333E)', value: '#05333E' },
  teal: { label: 'Teal (#14B8A6)', value: '#14B8A6' },
  blue: { label: 'Blue (#3B82F6)', value: '#3B82F6' },
  red: { label: 'Red (#EF4444)', value: '#EF4444' },
  gray: { label: 'Gray (#9CA3AF)', value: '#9CA3AF' },
} as const;

/** Border samples: the declarations each one adds to the bordered parts. */
const BORDERS: Record<Exclude<Customization['border'], 'layout'>, Record<string, string>> = {
  none: { borderStyle: 'none', borderWidth: '0px' },
  thin: { borderStyle: 'solid', borderWidth: '1px' },
  thick: { borderStyle: 'solid', borderWidth: '2px' },
  dashed: { borderStyle: 'dashed', borderWidth: '1px' },
  underline: { borderStyle: 'solid', borderWidth: '0px 0px 1px 0px', borderRadius: '0px' },
};

/** Parts of the card form that draw a border. */
const BORDERED_PARTS = ['CardFieldInput', 'PaymentMethodRow', 'PaymentMethodTile'] as const;

export const ACCENT_COLORS = [
  'blue',
  'indigo',
  'iris',
  'violet',
  'purple',
  'pink',
  'crimson',
  'red',
  'orange',
  'amber',
  'gold',
  'grass',
  'green',
  'jade',
  'teal',
  'cyan',
  'sky',
  'gray',
] as const;

const RADIUS: Record<Exclude<Customization['radius'], 'layout'>, string> = {
  square: '2px',
  rounded: '12px',
  round: '20px',
};

/** The page's own colour scheme, so the default layouts match it. */
function pageScheme(): 'light' | 'dark' {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

/** The appearance the card form gets: the layout's, then the developer's changes on top. */
export function appearanceFor(layout: CheckoutLayout, custom: Customization): Appearance {
  const theme = { ...layout.appearance.theme };
  if (custom.scheme !== 'layout') theme.appearance = custom.scheme;
  else if (!layout.original) theme.appearance ??= pageScheme();
  if (custom.accentColor !== 'layout') theme.accentColor = custom.accentColor;

  const classes: Record<string, Record<string, string>> = {};
  for (const [part, style] of Object.entries(layout.appearance.classes ?? {})) classes[part] = { ...style };
  const style = (part: string, declarations: Record<string, string>) => {
    classes[part] = { ...classes[part], ...declarations };
  };
  if (custom.radius !== 'layout') {
    const radius = RADIUS[custom.radius];
    style('CardFieldInput', { borderRadius: radius });
    style('PaymentMethodRow', { borderRadius: radius });
    style('PaymentMethodTile', { borderRadius: radius });
  }
  if (custom.fontSize !== 'layout') {
    style('CardFieldInput', { fontSize: custom.fontSize });
    style('PaymentMethodLabel', { fontSize: custom.fontSize });
  }
  if (custom.border !== 'layout') {
    for (const part of BORDERED_PARTS) style(part, BORDERS[custom.border]);
  }
  const borderColor =
    custom.borderColor === 'layout'
      ? null
      : custom.borderColor === 'custom'
        ? custom.customBorderColor
        : BORDER_COLORS[custom.borderColor].value;
  if (borderColor) {
    for (const part of BORDERED_PARTS) style(part, { borderColor });
    // The focused field: the same colour, with a soft ring of it.
    style('CardFieldInputFocused', { borderColor, boxShadow: `0 0 0 3px ${borderColor}33` });
  }
  const appearance: Appearance = {};
  if (Object.keys(theme).length > 0) appearance.theme = theme;
  if (Object.keys(classes).length > 0) appearance.classes = classes;
  return appearance;
}
