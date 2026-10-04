/**
 * Creates the payment intent (server side, through the playground's proxy), then shows the card form with the React
 * SDK and confirms the payment in the browser, as a shop's checkout page does.
 */
import type { CreatePaymentIntentParams } from '@loompay/loomgate-js-sdk/server';
import {
  type BillingDetails,
  BrandingElement,
  LoomgatePayment,
  LoomgateProvider,
  PaymentElement,
  useLoomgatePayment,
} from '@loompay/loomgate-react-sdk';
import { useState } from 'react';
import { ExchangeView } from '@/components/ExchangeView';
import { Step } from '@/components/Step';
import { TextField } from '@/components/TextField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldError, FieldLegend, FieldSet } from '@/components/ui/field';
import { createPaymentIntent, type Exchange, type PaymentIntent } from '@/lib/api';
import { getLoomgate } from '@/lib/loomgate';
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
  const [billing, setBilling] = useState({ email: '', name: '', line1: '', postalCode: '', country: '' });
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

  const billingDetails: BillingDetails = {
    email: billing.email.trim(),
    name: billing.name.trim(),
    address: {
      line1: billing.line1.trim(),
      postal_code: billing.postalCode.trim(),
      country: billing.country.trim().toUpperCase(),
    },
  };
  const setBillingField = (key: keyof typeof billing) => (value: string) =>
    setBilling((current) => ({ ...current, [key]: value }));

  return (
    <Step
      number={3}
      title="Pay"
      description="Your server creates the payment intent; the page mounts the card form with its client secret and confirms."
      snippets={paySnippets(publishableKey)}
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
          <FieldSet>
            <FieldLegend variant="label">Billing details (entered by the buyer with the card)</FieldLegend>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField label="Email" type="email" value={billing.email} onValueChange={setBillingField('email')} />
              <TextField label="Name on card" value={billing.name} onValueChange={setBillingField('name')} />
              <TextField
                fieldClassName="sm:col-span-2"
                label="Address"
                value={billing.line1}
                onValueChange={setBillingField('line1')}
              />
              <TextField label="Postal code" value={billing.postalCode} onValueChange={setBillingField('postalCode')} />
              <TextField
                label="Country (2 letters)"
                maxLength={2}
                value={billing.country}
                onValueChange={setBillingField('country')}
              />
            </div>
          </FieldSet>
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
              <LoomgateProvider
                key={`${publishableKey}\n${apiBaseUrl}`}
                loomgate={getLoomgate(publishableKey.trim(), apiBaseUrl)}
              >
                <LoomgatePayment clientSecret={checkout.clientSecret}>
                  <PaymentElement className="min-h-28" />
                  <PayButton
                    billingDetails={billingDetails}
                    onConfirmed={(id, status) => {
                      // The card form is taken off the page: it would otherwise keep showing the card details.
                      setConfirmed({ id, status });
                      onPaid(id);
                    }}
                  />
                  {/* Required: without the branding notice the card form refuses to confirm. */}
                  <BrandingElement />
                </LoomgatePayment>
              </LoomgateProvider>
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

function PayButton({
  billingDetails,
  onConfirmed,
}: {
  billingDetails: BillingDetails;
  onConfirmed: (paymentIntentId: string, status: string) => void;
}) {
  const { status, canConfirm, confirm, error, amountTotal, currency } = useLoomgatePayment();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  function handlePay() {
    setBusy(true);
    setMessage(null);
    // No await before confirm(): wallets need the click's user activation.
    confirm({ billingDetails }).then((result) => {
      setBusy(false);
      if (result.error) {
        const code = [result.error.type, result.error.code, result.error.declineCode].filter(Boolean).join(' / ');
        setMessage(`${result.error.message} (${code})`);
        return;
      }
      onConfirmed(result.paymentIntentId, result.status);
    });
  }

  if (status === 'error') {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          The card form could not load: {error?.message} ({error?.code})
          {error?.code === 'invalid_api_key' ? '. Check the publishable key.' : '.'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button className="self-start" onClick={handlePay} disabled={!canConfirm} loading={busy || status === 'loading'}>
        {amountTotal !== null && currency ? `Pay ${formatAmount(amountTotal, currency)}` : 'Pay'}
      </Button>
      {message && <FieldError>{message}</FieldError>}
    </div>
  );
}
