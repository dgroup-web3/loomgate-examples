import { useState } from 'react';
import { AmountTable } from '@/components/AmountTable';
import { ExchangeView } from '@/components/ExchangeView';
import { Step } from '@/components/Step';
import { Button } from '@/components/ui/button';
import { FieldError } from '@/components/ui/field';
import { createFeeQuote, type Exchange, type FeeQuote } from '@/lib/api';
import { feeQuoteSnippets } from '@/lib/snippets';

interface FeeStepProps {
  secretKey: string;
  /** The order's amount, or null while the order is incomplete. */
  amount: number | null;
  currency: 'usd' | 'eur';
  disabledReason: string | null;
}

export function FeeStep({ secretKey, amount, currency, disabledReason }: FeeStepProps) {
  const [quote, setQuote] = useState<FeeQuote | null>(null);
  const [exchange, setExchange] = useState<Exchange | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleQuote() {
    if (amount === null) return;
    setBusy(true);
    setError(null);
    const result = await createFeeQuote(secretKey, amount, currency);
    setBusy(false);
    setExchange(result.exchange);
    if (result.ok) setQuote(result.data);
    else {
      setQuote(null);
      setError(`${result.error.message} (${result.error.code})`);
    }
  }

  return (
    <Step
      number={2}
      title="Preview the fees"
      description="What this amount costs with your account's pricing, before anyone pays. Nothing is charged."
      snippets={feeQuoteSnippets(amount ?? 1250, currency)}
      inactive={disabledReason !== null}
    >
      <Button className="self-start" onClick={handleQuote} loading={busy} disabled={disabledReason !== null}>
        Get a fee quote
      </Button>
      {disabledReason && <p className="text-sm text-muted-foreground">{disabledReason}</p>}
      {error && <FieldError>{error}</FieldError>}
      {quote && (
        <AmountTable
          label="Fee quote"
          currency={quote.currency}
          rows={[
            { label: 'Price', value: quote.amount },
            {
              label: 'Fees paid by',
              value: quote.fee_bearer,
              hint:
                quote.fee_bearer === 'buyer' ? `Added to the total as “${quote.label}”` : 'Taken from what you receive',
            },
            { label: 'Processing fee', value: quote.processing_fee },
            { label: 'Bank fee', value: quote.bank_fee },
            { label: 'Fee added for the buyer', value: quote.fee_buyer },
            { label: 'The card is charged', value: quote.amount_total, strong: true },
            {
              label: 'You receive',
              value: quote.amount_total - quote.processing_fee - quote.bank_fee,
              hint: 'Charged − processing fee − bank fee',
              strong: true,
            },
          ]}
        />
      )}
      <ExchangeView exchange={exchange} />
    </Step>
  );
}
