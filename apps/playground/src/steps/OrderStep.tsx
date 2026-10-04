import { PlusIcon, Trash2Icon } from 'lucide-react';
import { ChoiceField } from '@/components/ChoiceField';
import { Step } from '@/components/Step';
import { TextField } from '@/components/TextField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldLegend, FieldSet } from '@/components/ui/field';
import { formatAmount } from '@/lib/money';
import { type BuildResult, newItem, type OrderDraft } from '@/lib/order';
import { orderSnippets } from '@/lib/snippets';

interface OrderStepProps {
  draft: OrderDraft;
  built: BuildResult;
  onChange: (draft: OrderDraft) => void;
  /** A payment intent exists for this order: start a new payment to change it. */
  locked: boolean;
}

export function OrderStep({ draft, built, onChange, locked }: OrderStepProps) {
  const set = <K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) => onChange({ ...draft, [key]: value });
  const setAddress = (key: keyof OrderDraft['address'], value: string) =>
    onChange({ ...draft, address: { ...draft.address, [key]: value } });
  const setItem = (index: number, key: 'name' | 'quantity' | 'unitPrice', value: string) =>
    onChange({ ...draft, items: draft.items.map((item, i) => (i === index ? { ...item, [key]: value } : item)) });

  return (
    <Step
      number={1}
      title="Create an order"
      description="What the buyer pays for. Your server turns it into a payment intent; nothing is sent until step 3."
      snippets={orderSnippets(built.ok ? built.params : null)}
    >
      <fieldset disabled={locked} className="flex flex-col gap-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <ChoiceField
            label="Currency"
            value={draft.currency}
            options={[
              { value: 'usd', label: 'USD' },
              { value: 'eur', label: 'EUR' },
            ]}
            onValueChange={(currency) => set('currency', currency)}
            disabled={locked}
          />
          <ChoiceField
            label="Goods"
            value={draft.goodsType}
            options={[
              { value: 'physical', label: 'Physical (ships)' },
              { value: 'non_physical', label: 'Digital / services' },
            ]}
            onValueChange={(goodsType) => set('goodsType', goodsType)}
            disabled={locked}
          />
        </div>

        <FieldSet>
          <FieldLegend variant="label">Items</FieldLegend>
          {draft.items.map((item, index) => (
            <div
              key={item.key}
              className="grid grid-cols-[1fr_1fr_auto] items-end gap-2 sm:grid-cols-[1fr_4.5rem_6rem_auto]"
            >
              <TextField
                fieldClassName="col-span-full sm:col-span-1"
                label="Name"
                value={item.name}
                onValueChange={(v) => setItem(index, 'name', v)}
              />
              <TextField
                label="Qty"
                inputMode="decimal"
                value={item.quantity}
                onValueChange={(v) => setItem(index, 'quantity', v)}
              />
              <TextField
                label="Unit price"
                inputMode="decimal"
                value={item.unitPrice}
                onValueChange={(v) => setItem(index, 'unitPrice', v)}
              />
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Remove item ${index + 1}`}
                disabled={draft.items.length === 1}
                onClick={() =>
                  set(
                    'items',
                    draft.items.filter((_, i) => i !== index),
                  )
                }
              >
                <Trash2Icon />
              </Button>
            </div>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="self-start"
            disabled={draft.items.length >= 100}
            onClick={() => set('items', [...draft.items, newItem()])}
          >
            <PlusIcon /> Add item
          </Button>
        </FieldSet>

        <div className="grid grid-cols-3 gap-2">
          <TextField
            label="Shipping"
            inputMode="decimal"
            placeholder="0.00"
            value={draft.shipping}
            onValueChange={(v) => set('shipping', v)}
          />
          <TextField
            label="Tax"
            inputMode="decimal"
            placeholder="0.00"
            value={draft.tax}
            onValueChange={(v) => set('tax', v)}
          />
          <TextField
            label="Discount"
            inputMode="decimal"
            placeholder="0.00"
            value={draft.discount}
            onValueChange={(v) => set('discount', v)}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <TextField
            label="Buyer name"
            autoComplete="off"
            value={draft.buyerName}
            onValueChange={(v) => set('buyerName', v)}
          />
          <TextField
            label="Order reference"
            value={draft.orderReference}
            onValueChange={(v) => set('orderReference', v)}
            description="Your own order number."
          />
        </div>

        {draft.goodsType === 'physical' && (
          <FieldSet>
            <FieldLegend variant="label">Shipping address</FieldLegend>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextField
                fieldClassName="sm:col-span-2"
                label="Address"
                value={draft.address.line1}
                onValueChange={(v) => setAddress('line1', v)}
              />
              <TextField
                fieldClassName="sm:col-span-2"
                label="Apartment, suite (optional)"
                value={draft.address.line2}
                onValueChange={(v) => setAddress('line2', v)}
              />
              <TextField label="City" value={draft.address.city} onValueChange={(v) => setAddress('city', v)} />
              <TextField
                label="State / region"
                value={draft.address.state}
                onValueChange={(v) => setAddress('state', v)}
              />
              <TextField
                label="Postal code"
                value={draft.address.postalCode}
                onValueChange={(v) => setAddress('postalCode', v)}
              />
              <TextField
                label="Country (2 letters)"
                maxLength={2}
                value={draft.address.country}
                onValueChange={(v) => setAddress('country', v)}
              />
            </div>
          </FieldSet>
        )}
      </fieldset>

      {built.ok ? (
        <p className="text-sm">
          Amount: <strong>{formatAmount(built.params.amount, built.params.currency)}</strong>{' '}
          <span className="text-muted-foreground">
            (items + shipping + tax − discount; at least 0.50, and more than the fees if you pay them)
          </span>
        </p>
      ) : (
        <Alert variant="warning">
          <AlertDescription>
            <ul className="list-disc pl-4">
              {built.problems.map((problem) => (
                <li key={problem}>{problem}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
      {locked && (
        <p className="text-sm text-muted-foreground">
          This order has a payment intent. Use “Start a new payment” in step 3 to change it.
        </p>
      )}
    </Step>
  );
}
