import { RefreshCwIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AmountTable } from '@/components/AmountTable';
import { ExchangeView } from '@/components/ExchangeView';
import { Step } from '@/components/Step';
import { TextField } from '@/components/TextField';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { createRefund, type Exchange, type PaymentIntent, type Refund, retrieveRefund } from '@/lib/api';
import { formatAmount, parseAmount, toMajorInput } from '@/lib/money';
import { refundSnippets } from '@/lib/snippets';

interface RefundStepProps {
  secretKey: string;
  intent: PaymentIntent | null;
  onRefunded: () => void;
}

export function RefundStep({ secretKey, intent, onRefunded }: RefundStepProps) {
  const [amountInput, setAmountInput] = useState('');
  const [reason, setReason] = useState('');
  const [refund, setRefund] = useState<Refund | null>(null);
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  /** One idempotency key per refund: kept for retries until Loomgate answers 200, then a new one. */
  const idempotencyKey = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const secretKeyRef = useRef(secretKey);
  secretKeyRef.current = secretKey;

  // A new payment: forget the previous payment's refund.
  const intentId = intent?.id;
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset when the payment intent changes.
  useEffect(() => {
    clearTimeout(timer.current);
    setRefund(null);
    setExchange(null);
    setError(null);
    idempotencyKey.current = null;
  }, [intentId]);
  useEffect(() => () => clearTimeout(timer.current), []);

  /** A refund starts `pending`: read it again until it is `succeeded` or `failed` (for up to a minute). */
  const pollRefund = useCallback(
    async (id: string, attempt: number) => {
      clearTimeout(timer.current);
      const result = await retrieveRefund(secretKeyRef.current, id);
      setExchange(result.exchange);
      if (!result.ok) {
        setError(`${result.error.message} (${result.error.code})`);
        return;
      }
      setRefund(result.data);
      const final = result.data.status === 'succeeded' || result.data.status === 'failed';
      if (final) onRefunded();
      else if (attempt < 30) timer.current = setTimeout(() => void pollRefund(id, attempt + 1), 2000);
    },
    [onRefunded],
  );

  const refundable = intent?.status === 'succeeded' ? intent.amount_refundable : 0;
  useEffect(() => {
    setAmountInput(refundable > 0 ? toMajorInput(refundable) : '');
  }, [refundable]);

  const amount = parseAmount(amountInput);
  const disabledReason = !intent
    ? 'Pay in step 3 first.'
    : intent.status !== 'succeeded'
      ? 'Only a succeeded payment can be refunded.'
      : refundable === 0
        ? 'Nothing left to refund.'
        : null;

  async function handleRefund() {
    if (!intent || amount === null) return;
    idempotencyKey.current ??= `playground-refund-${crypto.randomUUID()}`;
    setBusy(true);
    setError(null);
    const result = await createRefund(
      secretKey,
      { payment_intent: intent.id, amount, ...(reason.trim() ? { reason: reason.trim() } : {}) },
      idempotencyKey.current,
    );
    setBusy(false);
    setExchange(result.exchange);
    if (!result.ok) {
      setError(`${result.error.message} (${result.error.code})`);
      return;
    }
    idempotencyKey.current = null;
    setRefund(result.data);
    onRefunded();
    timer.current = setTimeout(() => void pollRefund(result.data.id, 0), 2000);
  }

  return (
    <Step
      number={5}
      title="Refund"
      description="Give money back to the buyer: all of what is refundable, or part of it."
      snippets={refundSnippets(intent?.id ?? null, amount)}
      inactive={disabledReason !== null && !refund}
    >
      <Alert variant="warning">
        <AlertDescription>
          Fees are never refunded: the buyer gets back at most what is still refundable
          {refundable > 0 && intent ? ` (${formatAmount(refundable, intent.currency)})` : ''}, and a refund fee is
          charged to you.
        </AlertDescription>
      </Alert>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          label="Amount"
          inputMode="decimal"
          value={amountInput}
          onValueChange={setAmountInput}
          disabled={disabledReason !== null}
        />
        <TextField
          label="Reason (optional)"
          value={reason}
          onValueChange={setReason}
          disabled={disabledReason !== null}
        />
      </div>
      <Button
        variant="destructive"
        className="self-start"
        onClick={handleRefund}
        loading={busy}
        disabled={disabledReason !== null || amount === null || amount === 0}
      >
        Refund{amount && intent ? ` ${formatAmount(amount, intent.currency)}` : ''}
      </Button>
      {disabledReason && <p className="text-sm text-muted-foreground">{disabledReason}</p>}
      {error && <FieldError>{error}</FieldError>}
      {refund && intent && (
        <>
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">Refund {refund.id}</span>
            <Button variant="outline" size="sm" onClick={() => void pollRefund(refund.id, 30)}>
              <RefreshCwIcon /> Retrieve refund
            </Button>
          </div>

          <AmountTable
            label="Refund"
            currency={intent.currency}
            rows={[
              { label: 'Status', value: refund.status, hint: 'pending → succeeded or failed' },
              { label: 'Returned to the buyer', value: refund.amount, strong: true },
              { label: 'Refund fee (charged to you)', value: refund.refund_fee },
            ]}
          />
        </>
      )}
      <ExchangeView exchange={exchange} />
    </Step>
  );
}
