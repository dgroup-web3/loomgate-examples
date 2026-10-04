/**
 * The card form, with the React SDK:
 *
 *   <LoomgateProvider loomgate={promise}>          one per app, with the promise created once
 *     <LoomgatePayment clientSecret="lg_cs_…">     one per payment intent
 *       <PaymentElement /> <PayButton /> <BrandingElement />
 */
import {
  type BillingDetails,
  BrandingElement,
  LoomgatePayment,
  LoomgateProvider,
  PaymentElement,
  useLoomgatePayment,
} from '@loompay/loomgate-react-sdk';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FieldError } from '@/components/ui/field';
import { type Checkout, formatAmount } from '@/lib/api';
import { loomgatePromise } from '@/lib/loomgate';
import type { Details } from '@/pages/CheckoutPage';

interface PaymentFormProps {
  checkout: Checkout;
  details: Details;
  onEdit: () => void;
}

export function PaymentForm({ checkout, details, onEdit }: PaymentFormProps) {
  const billingDetails: BillingDetails = {
    email: details.email.trim(),
    name: details.name.trim(),
    address: {
      line1: details.line1.trim(),
      line2: details.line2.trim() || undefined,
      city: details.city.trim() || undefined,
      state: details.state.trim() || undefined,
      postal_code: details.postal_code.trim(),
      country: details.country.trim().toUpperCase(),
    },
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment</CardTitle>
      </CardHeader>
      <CardContent>
        <LoomgateProvider loomgate={loomgatePromise}>
          <LoomgatePayment clientSecret={checkout.clientSecret}>
            {/* Render both elements from the start: the session is created once both containers exist. */}
            <PaymentElement className="min-h-28" />
            <PayButton paymentIntentId={checkout.paymentIntentId} billingDetails={billingDetails} onEdit={onEdit} />
            {/* Required: without the branding notice the card form refuses to confirm. */}
            <BrandingElement className="mt-3" />
          </LoomgatePayment>
        </LoomgateProvider>
      </CardContent>
    </Card>
  );
}

function PayButton({
  paymentIntentId,
  billingDetails,
  onEdit,
}: {
  paymentIntentId: string;
  billingDetails: BillingDetails;
  onEdit: () => void;
}) {
  const { status, canConfirm, confirm, error, amountTotal, currency } = useLoomgatePayment();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const orderUrl = new URL(`/order?payment_intent=${encodeURIComponent(paymentIntentId)}`, window.location.origin);

  function handlePay() {
    setBusy(true);
    setMessage(null);
    // Call confirm() directly in the click handler and await nothing before it: wallets need the click's user activation.
    confirm({
      billingDetails,
      // Where the buyer comes back after a 3-D Secure redirect. Must be https://.
      returnUrl: orderUrl.protocol === 'https:' ? orderUrl.href : undefined,
    }).then((result) => {
      if (result.error) {
        // Neutral English, safe to show. For `payment_intent_updated` the amount changed and nothing was charged: the
        // button already shows the new amount, so the buyer can review it and press Pay again.
        setBusy(false);
        // A validation error (`invalid_customer_details`) lists each field to fix in `issues`.
        const issues = result.error.issues ?? [];
        setMessage(issues.length > 0 ? issues.map((issue) => issue.message).join(' ') : result.error.message);
        return;
      }
      // 'succeeded' or 'processing'. The order page reads the final status from the server.
      window.location.assign(orderUrl.href);
    });
  }

  if (status === 'error') return <FieldError>{error?.message}</FieldError>;

  return (
    <>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={handlePay} disabled={!canConfirm} loading={busy || status === 'loading'}>
          {/* The amount the card form will charge. Always display this one. */}
          {amountTotal !== null && currency ? `Pay ${formatAmount(amountTotal, currency)}` : 'Pay'}
        </Button>
        <Button variant="outline" onClick={onEdit} disabled={busy}>
          Change details
        </Button>
      </div>
      {message && <FieldError className="mt-3">{message}</FieldError>}
    </>
  );
}
