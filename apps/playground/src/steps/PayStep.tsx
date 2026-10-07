/**
 * Creates the payment intent (server side, through the playground's proxy), then shows the card form with the React
 * SDK and confirms the payment in the browser, as a shop's checkout page does. The card form can be shown in several
 * layouts (src/lib/layouts.ts) and restyled live with the "Style" controls, to show what a shop can customize.
 */
import type { CreatePaymentIntentParams } from '@loompay/loomgate-js-sdk/server';
import { useMemo, useState } from 'react';
import { type Billing, CheckoutForm } from '@/components/CheckoutForm';
import { ChoiceField } from '@/components/ChoiceField';
import { ExchangeView } from '@/components/ExchangeView';
import { Step } from '@/components/Step';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { createPaymentIntent, type Exchange, type PaymentIntent } from '@/lib/api';
import {
  ACCENT_COLORS,
  appearanceFor,
  BORDER_COLORS,
  type Customization,
  checkoutLayouts,
  ICONS,
  type LayoutId,
  NO_CUSTOMIZATION,
} from '@/lib/layouts';
import { formatAmount } from '@/lib/money';
import { paySnippets } from '@/lib/snippets';

export interface Checkout {
  intent: PaymentIntent;
  clientSecret: string;
}

interface PayStepProps {
  publishableKey: string;
  secretKey: string;
  apiBaseUrl: string | null;
  params: CreatePaymentIntentParams | null;
  disabledReason: string | null;
  checkout: Checkout | null;
  /** The latest status Loomgate reported for the checkout's payment intent. */
  intentStatus: PaymentIntent['status'] | null;
  onCheckout: (checkout: Checkout) => void;
  onPaid: (paymentIntentId: string) => void;
  onStartOver: () => void;
}

export function PayStep({
  publishableKey,
  secretKey,
  apiBaseUrl,
  params,
  disabledReason,
  checkout,
  intentStatus,
  onCheckout,
  onPaid,
  onStartOver,
}: PayStepProps) {
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [billing, setBilling] = useState<Billing>({ email: '', name: '', line1: '', postalCode: '', country: '' });
  const layouts = useMemo(checkoutLayouts, []);
  const [layoutId, setLayoutId] = useState<LayoutId>('stacked');
  const layout = layouts.find((candidate) => candidate.id === layoutId) ?? layouts[0]!;
  const [custom, setCustom] = useState<Customization>(NO_CUSTOMIZATION);
  const appearance = useMemo(() => appearanceFor(layout, custom), [layout, custom]);
  const customize =
    <K extends keyof Customization>(key: K) =>
    (value: Customization[K]) =>
      setCustom((current) => ({ ...current, [key]: value }));
  /** What confirm() returned, for this payment intent. Once set, the card form is removed from the page. */
  const [confirmed, setConfirmed] = useState<{ id: string; status: string } | null>(null);
  const confirmedStatus = confirmed && confirmed.id === checkout?.intent.id ? confirmed.status : null;

  async function handleCreate() {
    if (!params) return;
    setBusy(true);
    setError(null);
    // A new key per click here; a shop would use its order id, so a retry returns the same intent.
    const result = await createPaymentIntent(secretKey, params, `playground-${crypto.randomUUID()}`);
    setBusy(false);
    setExchange(result.exchange);
    if (!result.ok) {
      setError(`${result.error.message} (${result.error.code}${result.error.param ? `, ${result.error.param}` : ''})`);
      return;
    }
    const clientSecret = result.data.client_secret;
    if (!clientSecret) {
      setError('The response has no client_secret.');
      return;
    }
    // Pre-fill the billing details from the order. The buyer can change them.
    const address = params.shipping_details?.address;
    setBilling((current) => ({
      email: current.email,
      name: current.name || params.buyer?.name || '',
      line1: current.line1 || address?.line1 || '',
      postalCode: current.postalCode || address?.postal_code || '',
      country: current.country || address?.country || '',
    }));
    onCheckout({ intent: result.data, clientSecret });
  }

  return (
    <Step
      number={3}
      title="Pay"
      description="Your server creates the payment intent; the page mounts the card form with its client secret and confirms."
      snippets={paySnippets(publishableKey, layout, appearance)}
      inactive={disabledReason !== null && !checkout}
    >
      {!checkout ? (
        <>
          <Button
            className="self-start"
            onClick={handleCreate}
            loading={busy}
            disabled={disabledReason !== null || !params}
          >
            Create payment intent{params ? ` (${formatAmount(params.amount, params.currency)})` : ''}
          </Button>
          {disabledReason && <p className="text-sm text-muted-foreground">{disabledReason}</p>}
        </>
      ) : (
        <>
          <p className="text-sm">
            Payment intent <code className="font-mono text-xs">{checkout.intent.id}</code> · the card will be charged{' '}
            <strong>{formatAmount(checkout.intent.amount_total, checkout.intent.currency)}</strong>
          </p>
          {confirmedStatus ? (
            <div className="flex flex-col gap-2">
              <p className="text-sm">
                <code className="font-mono text-xs">confirm()</code> returned <strong>{confirmedStatus}</strong>.
              </p>
              <p className="text-sm text-muted-foreground">
                This is what the browser saw, and it is provisional. Loomgate's own status (step 4) is the one to trust:
                it becomes <code>succeeded</code> once the payment network confirms the payment.
              </p>
            </div>
          ) : intentStatus !== null && intentStatus !== 'pending' ? (
            // Only a pending intent can be paid: mounting the card form for another one would only show an error.
            <p className="text-sm text-muted-foreground">
              This payment intent is <strong>{intentStatus}</strong>, so it can no longer be paid. Start a new payment
              to pay again.
            </p>
          ) : (
            apiBaseUrl && (
              <>
                <div className="flex flex-col gap-1">
                  <ChoiceField
                    label="Layout"
                    value={layoutId}
                    options={layouts.map((candidate) => ({ value: candidate.id, label: candidate.label }))}
                    onValueChange={setLayoutId}
                  />
                  <p className="text-sm text-muted-foreground">{layout.description}</p>
                </div>
                <fieldset className="flex flex-col gap-2 rounded-lg border p-3">
                  <legend className="px-1 text-sm font-medium">Style the card form</legend>
                  {/* Two per row, in pairs: colours, shape and text, border, icon. */}
                  <div className="grid items-start gap-x-4 gap-y-3 sm:grid-cols-2">
                    <ChoiceField
                      label="Colour scheme"
                      value={custom.scheme}
                      options={[
                        { value: 'layout', label: 'As the layout' },
                        { value: 'light', label: 'Light' },
                        { value: 'dark', label: 'Dark' },
                      ]}
                      onValueChange={customize('scheme')}
                    />
                    <ChoiceField
                      label="Accent colour"
                      value={custom.accentColor}
                      options={[
                        { value: 'layout', label: 'As the layout' },
                        ...ACCENT_COLORS.map((color) => ({ value: color, label: color })),
                      ]}
                      onValueChange={customize('accentColor')}
                    />
                    <ChoiceField
                      label="Corners"
                      value={custom.radius}
                      options={[
                        { value: 'layout', label: 'As the layout' },
                        { value: 'square', label: 'Square (2px)' },
                        { value: 'rounded', label: 'Rounded (12px)' },
                        { value: 'round', label: 'Round (20px)' },
                      ]}
                      onValueChange={customize('radius')}
                    />
                    <ChoiceField
                      label="Text size"
                      value={custom.fontSize}
                      options={[
                        { value: 'layout', label: 'As the layout' },
                        { value: '14px', label: '14px' },
                        { value: '16px', label: '16px' },
                        { value: '18px', label: '18px' },
                      ]}
                      onValueChange={customize('fontSize')}
                    />
                    <ChoiceField
                      label="Border"
                      value={custom.border}
                      options={[
                        { value: 'layout', label: 'As the layout' },
                        { value: 'none', label: 'None' },
                        { value: 'thin', label: 'Thin (1px)' },
                        { value: 'thick', label: 'Thick (2px)' },
                        { value: 'dashed', label: 'Dashed' },
                        { value: 'underline', label: 'Underline only' },
                      ]}
                      onValueChange={customize('border')}
                    />
                    <ChoiceField
                      label="Border colour"
                      value={custom.borderColor}
                      options={[
                        { value: 'layout', label: 'As the layout' },
                        ...(Object.keys(BORDER_COLORS) as (keyof typeof BORDER_COLORS)[]).map((key) => ({
                          value: key,
                          label: BORDER_COLORS[key].label,
                        })),
                        { value: 'custom', label: 'Custom…' },
                      ]}
                      onValueChange={customize('borderColor')}
                    />
                    {custom.borderColor === 'custom' && (
                      <label className="flex min-w-0 flex-col gap-2 text-sm font-medium">
                        Custom colour
                        <span className="flex items-center gap-2">
                          <input
                            type="color"
                            className="h-9 w-12 cursor-pointer rounded-md border bg-transparent p-1"
                            value={custom.customBorderColor}
                            onChange={(event) => customize('customBorderColor')(event.target.value)}
                          />
                          <code className="text-xs text-muted-foreground">{custom.customBorderColor}</code>
                        </span>
                      </label>
                    )}
                    <ChoiceField
                      label="Method icon"
                      value={custom.icon}
                      options={[
                        { value: 'layout', label: 'As the layout' },
                        ...(Object.keys(ICONS) as (keyof typeof ICONS)[]).map((key) => ({
                          value: key,
                          label: ICONS[key].label,
                        })),
                      ]}
                      onValueChange={customize('icon')}
                    />
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="self-start"
                    onClick={() => setCustom(NO_CUSTOMIZATION)}
                    disabled={JSON.stringify(custom) === JSON.stringify(NO_CUSTOMIZATION)}
                  >
                    Reset style
                  </Button>
                  <p className="text-xs text-muted-foreground">
                    Applied live through <code>appearance</code>: the card form keeps what was typed. The code tabs show
                    the result. The form's frame is transparent: pick the scheme that matches the background behind it.
                  </p>
                </fieldset>
                <CheckoutForm
                  layout={layout}
                  appearance={appearance}
                  publishableKey={publishableKey}
                  apiBaseUrl={apiBaseUrl}
                  intent={checkout.intent}
                  clientSecret={checkout.clientSecret}
                  billing={billing}
                  onBillingChange={setBilling}
                  onConfirmed={(id, status) => {
                    // The card form is taken off the page: it would otherwise keep showing the card details.
                    setConfirmed({ id, status });
                    onPaid(id);
                  }}
                />
              </>
            )
          )}
          <Button variant="outline" size="sm" className="self-start" onClick={onStartOver}>
            Start a new payment
          </Button>
        </>
      )}
      {error && <FieldError>{error}</FieldError>}
      <ExchangeView exchange={exchange} />
    </Step>
  );
}
