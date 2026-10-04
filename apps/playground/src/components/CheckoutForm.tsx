/**
 * The card form of step 3, in the layout the developer picked (src/lib/layouts.ts). Every layout uses the same React
 * SDK pieces — <PaymentElement>, a Pay button calling confirm(), <BrandingElement> — and only arranges and styles
 * them differently. The card form's own look comes from `appearance`, given to loadLoomgate().
 */
import {
  type BillingDetails,
  BrandingElement,
  LoomgatePayment,
  LoomgateProvider,
  PaymentElement,
  useLoomgatePayment,
} from '@loompay/loomgate-react-sdk';
import { LockIcon } from 'lucide-react';
import { type CSSProperties, createContext, type ReactNode, useContext, useState } from 'react';
import { TextField } from '@/components/TextField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import type { PaymentIntent } from '@/lib/api';
import type { CheckoutLayout } from '@/lib/layouts';
import { getLoomgate } from '@/lib/loomgate';
import { formatAmount } from '@/lib/money';
import { cn } from '@/lib/utils';

export interface Billing {
  email: string;
  name: string;
  line1: string;
  postalCode: string;
  country: string;
}

interface CheckoutFormProps {
  layout: CheckoutLayout;
  publishableKey: string;
  apiBaseUrl: string;
  intent: PaymentIntent;
  clientSecret: string;
  billing: Billing;
  onBillingChange: (billing: Billing) => void;
  onConfirmed: (paymentIntentId: string, status: string) => void;
}

/**
 * Billing problems found by confirm(). The SDK checks the billing details before anything is sent and returns a
 * `validation_error` / `invalid_customer_details` with `issues[]`: one `{ field, code, message }` per field.
 */
type Issues = Partial<Record<keyof Billing, string>>;

const FIELD_OF_ISSUE: Record<string, keyof Billing> = {
  email: 'email',
  name: 'name',
  'address.line1': 'line1',
  'address.postal_code': 'postalCode',
  'address.country': 'country',
};

const IssuesContext = createContext<{ issues: Issues; setIssues: (issues: Issues) => void }>({
  issues: {},
  setIssues: () => {},
});

export function CheckoutForm(rawProps: CheckoutFormProps) {
  const [issues, setIssues] = useState<Issues>({});
  // Editing a field clears its problem.
  const props: CheckoutFormProps = {
    ...rawProps,
    onBillingChange: (next) => {
      setIssues((current) => {
        const kept: Issues = {};
        for (const [field, message] of Object.entries(current) as [keyof Billing, string][]) {
          if (next[field] === rawProps.billing[field]) kept[field] = message;
        }
        return kept;
      });
      rawProps.onBillingChange(next);
    },
  };
  const { layout, publishableKey, apiBaseUrl, clientSecret } = props;
  return (
    <IssuesContext.Provider value={{ issues, setIssues }}>
      {/* A new layout = a new appearance = a new Loomgate instance and payment session (key). */}
      <LoomgateProvider
        key={`${publishableKey}\n${apiBaseUrl}\n${layout.id}`}
        loomgate={getLoomgate(publishableKey.trim(), apiBaseUrl, layout.appearance)}
      >
        <LoomgatePayment clientSecret={clientSecret}>
          {layout.id === 'compact' && <CompactLayout {...props} />}
          {layout.id === 'split' && <SplitLayout {...props} />}
          {layout.id === 'dark' && <DarkLayout {...props} />}
          {layout.id === 'stacked' && <StackedLayout {...props} />}
        </LoomgatePayment>
      </LoomgateProvider>
    </IssuesContext.Provider>
  );
}

function toBillingDetails(billing: Billing): BillingDetails {
  return {
    email: billing.email.trim(),
    name: billing.name.trim(),
    address: {
      line1: billing.line1.trim(),
      postal_code: billing.postalCode.trim(),
      country: billing.country.trim().toUpperCase(),
    },
  };
}

function BillingFields({
  billing,
  onBillingChange,
  emailOnly = false,
}: Pick<CheckoutFormProps, 'billing' | 'onBillingChange'> & { emailOnly?: boolean }) {
  const { issues } = useContext(IssuesContext);
  const set = (key: keyof Billing) => (value: string) => onBillingChange({ ...billing, [key]: value });
  const email = (
    <TextField label="Email" type="email" value={billing.email} error={issues.email} onValueChange={set('email')} />
  );
  const rest = (
    <div className="grid gap-3 sm:grid-cols-2">
      <TextField label="Name on card" value={billing.name} error={issues.name} onValueChange={set('name')} />
      <TextField
        label="Postal code"
        value={billing.postalCode}
        error={issues.postalCode}
        onValueChange={set('postalCode')}
      />
      <TextField
        fieldClassName="sm:col-span-2"
        label="Address"
        value={billing.line1}
        error={issues.line1}
        onValueChange={set('line1')}
      />
      <TextField
        label="Country (2 letters)"
        maxLength={2}
        value={billing.country}
        error={issues.country}
        onValueChange={set('country')}
      />
    </div>
  );
  if (emailOnly) {
    return (
      <div className="flex flex-col gap-3">
        {email}
        {/* Opened when a field inside has a problem, so the buyer sees it. */}
        <details
          className="text-sm"
          open={issues.name || issues.line1 || issues.postalCode || issues.country ? true : undefined}
        >
          <summary className="cursor-pointer text-muted-foreground">
            Billing address: {[billing.name, billing.line1, billing.country].filter(Boolean).join(', ') || 'add'}
          </summary>
          <div className="mt-3">{rest}</div>
        </details>
      </div>
    );
  }
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">{email}</div>
      <div className="sm:col-span-2">{rest}</div>
    </div>
  );
}

/** The shop's own Pay button: style it like any other button. It only calls confirm(). */
function PayButton({
  billing,
  onConfirmed,
  className,
  style,
  icon,
}: Pick<CheckoutFormProps, 'billing' | 'onConfirmed'> & {
  className?: string;
  style?: CSSProperties;
  icon?: ReactNode;
}) {
  const { status, canConfirm, confirm, error, amountTotal, currency } = useLoomgatePayment();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { setIssues } = useContext(IssuesContext);

  function handlePay() {
    setBusy(true);
    setMessage(null);
    setIssues({});
    // No await before confirm(): wallets need the click's user activation.
    confirm({ billingDetails: toBillingDetails(billing) }).then((result) => {
      setBusy(false);
      if (result.error) {
        const code = [result.error.type, result.error.code, result.error.declineCode].filter(Boolean).join(' / ');
        setMessage(`${result.error.message} (${code})`);
        // A validation error lists every field to fix: show each one under its field.
        const issues: Issues = {};
        for (const issue of result.error.issues ?? []) {
          const field = FIELD_OF_ISSUE[issue.field];
          if (field) issues[field] = issue.message;
        }
        setIssues(issues);
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
      <Button
        className={className}
        style={style}
        onClick={handlePay}
        disabled={!canConfirm}
        loading={busy || status === 'loading'}
      >
        {!busy && status !== 'loading' && icon}
        {amountTotal !== null && currency ? `Pay ${formatAmount(amountTotal, currency)}` : 'Pay'}
      </Button>
      {message && <FieldError>{message}</FieldError>}
    </div>
  );
}

/** Billing fields, card form, Pay button and branding, one under the other. */
function StackedLayout(props: CheckoutFormProps) {
  return (
    <div className="flex flex-col gap-4">
      <BillingFields billing={props.billing} onBillingChange={props.onBillingChange} />
      <PaymentElement className="min-h-28" />
      <PayButton billing={props.billing} onConfirmed={props.onConfirmed} className="self-start" />
      {/* Required: without the branding notice the card form refuses to confirm. */}
      <BrandingElement />
    </div>
  );
}

/** Everything in one panel; the address folds away; a full-width Pay button with the branding right under it. */
function CompactLayout(props: CheckoutFormProps) {
  return (
    <section className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-xl border bg-card p-4 shadow-sm">
      <BillingFields billing={props.billing} onBillingChange={props.onBillingChange} emailOnly />
      <PaymentElement className="min-h-28" />
      <PayButton
        billing={props.billing}
        onConfirmed={props.onConfirmed}
        className="h-11 w-full text-base"
        icon={<LockIcon />}
      />
      <BrandingElement className="mx-auto" />
    </section>
  );
}

/** The order summary next to the payment, as on a one-page checkout. */
function SplitLayout(props: CheckoutFormProps) {
  const { intent } = props;
  const money = (amount: number) => formatAmount(amount, intent.currency);
  const extras = [
    { label: 'Shipping', value: intent.shipping_amount },
    { label: 'Tax', value: intent.tax_amount },
    { label: 'Discount', value: -intent.discount_amount },
    { label: 'Fees', value: intent.fee_buyer },
  ].filter((row) => row.value !== 0);
  return (
    // Side by side only when the checkout itself is wide enough (container query), stacked otherwise.
    <div className="@container">
      <div className="grid gap-4 @xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <aside className="flex flex-col gap-2 rounded-xl bg-muted p-4 text-sm">
          <span className="font-medium">Order summary</span>
          {intent.items.map((item, index) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: the items of a payment intent never change order.
            <div key={`${item.name}-${index}`} className="flex justify-between gap-3">
              <span className="min-w-0 truncate">
                {item.name} × {item.quantity}
              </span>
              <span className="tabular-nums">{money(item.amount)}</span>
            </div>
          ))}
          {extras.map((row) => (
            <div key={row.label} className="flex justify-between gap-3 text-muted-foreground">
              <span>{row.label}</span>
              <span className="tabular-nums">{money(row.value)}</span>
            </div>
          ))}
          <div className="mt-1 flex justify-between gap-3 border-t pt-2 font-semibold">
            <span>Total</span>
            <span className="tabular-nums">{money(intent.amount_total)}</span>
          </div>
        </aside>
        <section className="flex min-w-0 flex-col gap-4">
          <BillingFields billing={props.billing} onBillingChange={props.onBillingChange} />
          <PaymentElement className="min-h-28" />
          <PayButton billing={props.billing} onConfirmed={props.onConfirmed} className="h-10 w-full" />
          <BrandingElement />
        </section>
      </div>
    </div>
  );
}

/**
 * A brand-coloured dark panel on any page theme. The page's colour variables are overridden inside the panel for the
 * shop's own fields; the card form follows through `appearance.theme.appearance: 'dark'`.
 */
const DARK_PANEL = {
  background: '#05333E',
  '--foreground': '#FAFAFF',
  '--muted-foreground': 'rgb(250 250 255 / 0.7)',
  '--border': 'rgb(250 250 255 / 0.15)',
  '--input': 'rgb(250 250 255 / 0.25)',
  '--card': '#05333E',
  color: '#FAFAFF',
  colorScheme: 'dark',
} as CSSProperties;

function DarkLayout(props: CheckoutFormProps) {
  return (
    <section style={DARK_PANEL} className={cn('flex flex-col gap-4 rounded-2xl p-5 text-foreground')}>
      <div className="flex items-center gap-2 font-medium">
        <LockIcon className="size-4" /> Pay securely
      </div>
      <BillingFields billing={props.billing} onBillingChange={props.onBillingChange} emailOnly />
      <PaymentElement className="min-h-28" />
      <PayButton
        billing={props.billing}
        onConfirmed={props.onConfirmed}
        className="h-11 w-full rounded-full text-base hover:opacity-90"
        style={{ background: '#B9E4FF', color: '#05333E' }}
      />
      <BrandingElement />
    </section>
  );
}
