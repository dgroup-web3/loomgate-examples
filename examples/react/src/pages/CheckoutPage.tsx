/**
 * 1. "Continue to payment": the server prices the cart and creates a payment intent → client secret.
 * 2. <PaymentForm> mounts the card form with that client secret and confirms the payment.
 */
import { AlertTriangleIcon } from 'lucide-react';
import { type FormEvent, useEffect, useState } from 'react';
import { PaymentForm } from '@/components/PaymentForm';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { type Catalog, type Checkout, formatAmount, getCatalog, startCheckout } from '@/lib/api';

export interface Details {
  email: string;
  name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

const EMPTY_DETAILS: Details = {
  email: '',
  name: '',
  line1: '',
  line2: '',
  city: '',
  state: '',
  postal_code: '',
  country: '',
};

export function CheckoutPage() {
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [details, setDetails] = useState<Details>(EMPTY_DETAILS);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCatalog()
      .then((loaded) => {
        setCatalog(loaded);
        setQuantities(Object.fromEntries(loaded.products.map((product, index) => [product.id, index === 0 ? 1 : 0])));
      })
      .catch((err: Error) => setError(`${err.message} Set the keys in .dev.vars (see README).`));
  }, []);

  const cart = Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => ({ id, quantity }));
  // Display only: the server computes the amount that is charged.
  const total = cart.reduce(
    (sum, line) => sum + (catalog?.products.find((p) => p.id === line.id)?.unitAmount ?? 0) * line.quantity,
    0,
  );
  const locked = checkout !== null;

  function update(field: keyof Details) {
    return (event: { target: { value: string } }) =>
      setDetails((current) => ({ ...current, [field]: event.target.value }));
  }

  async function handleContinue(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { email: _email, name, ...address } = details;
      setCheckout(
        await startCheckout({
          cart,
          customer: { name },
          shipping: { ...address, country: address.country.toUpperCase() },
        }),
      );
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <Alert variant="warning">
        <AlertTriangleIcon />
        <AlertDescription>
          Payments on this page are real: they charge the card and pay the merchant whose keys this server uses. Refund
          test payments from the merchant dashboard.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleContinue} className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Your order</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-2">
            {catalog?.products.map((product) => (
              <div key={product.id} className="flex items-center justify-between gap-3">
                <label htmlFor={`qty-${product.id}`}>
                  {product.name} · {formatAmount(product.unitAmount, catalog.currency)}
                </label>
                <Input
                  id={`qty-${product.id}`}
                  type="number"
                  min={0}
                  max={10}
                  className="w-20"
                  disabled={locked}
                  value={quantities[product.id] ?? 0}
                  onChange={(event) =>
                    setQuantities((current) => ({ ...current, [product.id]: Number(event.target.value) }))
                  }
                />
              </div>
            )) ?? <p className="text-muted-foreground">Loading…</p>}
            <div className="mt-2 flex justify-between border-t pt-3 font-semibold">
              <span>Total</span>
              <span>{catalog ? formatAmount(total, catalog.currency) : '—'}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contact and shipping</CardTitle>
          </CardHeader>
          <CardContent>
            <FieldGroup className="grid gap-3 sm:grid-cols-2">
              <TextField
                label="Email"
                type="email"
                autoComplete="email"
                required
                wide
                value={details.email}
                onChange={update('email')}
                disabled={locked}
              />
              <TextField
                label="Full name"
                autoComplete="name"
                required
                wide
                value={details.name}
                onChange={update('name')}
                disabled={locked}
              />
              <TextField
                label="Address"
                autoComplete="address-line1"
                required
                wide
                value={details.line1}
                onChange={update('line1')}
                disabled={locked}
              />
              <TextField
                label="Apartment, suite (optional)"
                autoComplete="address-line2"
                wide
                value={details.line2}
                onChange={update('line2')}
                disabled={locked}
              />
              <TextField
                label="City"
                autoComplete="address-level2"
                value={details.city}
                onChange={update('city')}
                disabled={locked}
              />
              <TextField
                label="State / region"
                autoComplete="address-level1"
                value={details.state}
                onChange={update('state')}
                disabled={locked}
              />
              <TextField
                label="Postal code"
                autoComplete="postal-code"
                required
                value={details.postal_code}
                onChange={update('postal_code')}
                disabled={locked}
              />
              <TextField
                label="Country (2 letters)"
                autoComplete="country"
                required
                maxLength={2}
                placeholder="US"
                value={details.country}
                onChange={update('country')}
                disabled={locked}
              />
            </FieldGroup>
            {!locked && (
              <Button type="submit" className="mt-4" loading={busy} disabled={cart.length === 0}>
                Continue to payment
              </Button>
            )}
          </CardContent>
        </Card>
      </form>

      {checkout && (
        <PaymentForm
          // A new key = a new payment session, e.g. after the buyer changed their details.
          key={checkout.paymentIntentId}
          checkout={checkout}
          details={details}
          onEdit={() => setCheckout(null)}
        />
      )}

      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}

function TextField({ label, wide, ...props }: React.ComponentProps<typeof Input> & { label: string; wide?: boolean }) {
  const id = `field-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`;
  return (
    <Field className={wide ? 'sm:col-span-2' : undefined}>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input id={id} {...props} />
    </Field>
  );
}
