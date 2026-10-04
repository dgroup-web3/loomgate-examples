import { RefreshCwIcon } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AmountTable } from '@/components/AmountTable';
import { ExchangeView } from '@/components/ExchangeView';
import { Step } from '@/components/Step';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { type Exchange, type PaymentIntent, retrievePaymentIntent } from '@/lib/api';
import { formatAmount } from '@/lib/money';
import { resultSnippets } from '@/lib/snippets';

const STATUS_BADGE = {
  succeeded: 'success',
  processing: 'warning',
  pending: 'secondary',
  canceled: 'destructive',
} as const;

interface ResultStepProps {
  secretKey: string;
  paymentIntentId: string | null;
  /** Bumped after a payment or a refund: read the intent again. */
  refreshToken: number;
  intent: PaymentIntent | null;
  onIntent: (intent: PaymentIntent) => void;
}

export function ResultStep({ secretKey, paymentIntentId, refreshToken, intent, onIntent }: ResultStepProps) {
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Read through a ref: typing in the key field must not trigger a new request on every keystroke.
  const secretKeyRef = useRef(secretKey);
  secretKeyRef.current = secretKey;

  const load = useCallback(
    async (attempt: number) => {
      if (!paymentIntentId) return;
      clearTimeout(timer.current);
      setBusy(true);
      const result = await retrievePaymentIntent(secretKeyRef.current, paymentIntentId);
      setBusy(false);
      setExchange(result.exchange);
      if (!result.ok) {
        setError(`${result.error.message} (${result.error.code})`);
        return;
      }
      setError(null);
      onIntent(result.data);
      // `processing` is not final: read again for up to a minute.
      if (result.data.status === 'processing' && attempt < 30) {
        timer.current = setTimeout(() => void load(attempt + 1), 2000);
      }
    },
    [paymentIntentId, onIntent],
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: refreshToken asks for a new read.
  useEffect(() => {
    void load(0);
    return () => clearTimeout(timer.current);
  }, [load, refreshToken]);

  const currency = intent?.currency ?? 'usd';
  return (
    <Step
      number={4}
      title="See the result and the fees"
      description="What Loomgate recorded: status, what the card was charged, the fees and what you receive."
      snippets={resultSnippets(paymentIntentId)}
      inactive={!paymentIntentId}
    >
      {!paymentIntentId ? (
        <p className="text-sm text-muted-foreground">Create a payment intent in step 3 first.</p>
      ) : (
        <div className="flex items-center gap-2">
          {intent && <Badge variant={STATUS_BADGE[intent.status]}>{intent.status}</Badge>}
          <Button variant="outline" size="sm" onClick={() => void load(0)} loading={busy}>
            <RefreshCwIcon /> Retrieve again
          </Button>
        </div>
      )}
      {error && <FieldError>{error}</FieldError>}
      {intent?.status === 'processing' && (
        <Alert variant="info">
          <AlertDescription>
            <strong>processing</strong> is not paid yet. Loomgate marks the payment <strong>succeeded</strong> when the
            payment network confirms it, usually within seconds, at the latest within about 15 minutes. This page checks
            again for a minute; after that, press “Retrieve again”. Your server learns it from the{' '}
            <code>payment_intent.succeeded</code> webhook.
          </AlertDescription>
        </Alert>
      )}
      {intent && (
        <>
          <AmountTable
            label="Payment breakdown"
            currency={currency}
            rows={[
              { label: 'Price', value: intent.amount },
              { label: 'Fees paid by', value: intent.fee_bearer },
              { label: 'Processing fee', value: intent.processing_fee },
              { label: 'Bank fee', value: intent.bank_fee },
              { label: 'Fee added for the buyer', value: intent.fee_buyer },
              { label: 'The card is charged', value: intent.amount_total, strong: true },
              {
                label: 'You receive',
                value: intent.amount_total - intent.processing_fee - intent.bank_fee,
                hint: 'Before refunds',
                strong: true,
              },
              { label: 'Refunded', value: intent.amount_refunded },
              { label: 'Still refundable', value: intent.amount_refundable, hint: 'Fees are never refunded' },
            ]}
          />
          {intent.items_difference !== 0 && (
            <p className="text-sm text-muted-foreground">
              items_difference = {formatAmount(intent.items_difference, currency)}: the items do not add up to the
              amount. Loomgate only reports it; the card is charged the amount.
            </p>
          )}
          {intent.unlock_schedule.length > 0 && (
            <Table label="Unlock schedule">
              <TableHeader>
                <TableRow>
                  <TableHead>Step</TableHead>
                  <TableHead>Available</TableHead>
                  <TableHead className="text-right">Share</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {intent.unlock_schedule.map((step) => (
                  <TableRow key={step.step}>
                    <TableCell>{step.step}</TableCell>
                    <TableCell>{new Date(step.available_at * 1000).toLocaleString()}</TableCell>
                    <TableCell className="text-right tabular-nums">{step.percent_bps / 100}%</TableCell>
                    <TableCell className="text-right tabular-nums">{formatAmount(step.remaining, currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </>
      )}
      <ExchangeView exchange={exchange} />
    </Step>
  );
}
