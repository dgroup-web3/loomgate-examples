import { AlertTriangleIcon, ShieldAlertIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { KeysCard, keysProblem } from '@/components/KeysCard';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { getConfig, type PaymentIntent } from '@/lib/api';
import { type Keys, loadKeys, saveKeys } from '@/lib/keys';
import { buildPaymentIntentParams, defaultDraft, newOrderReference, type OrderDraft } from '@/lib/order';
import { FeeStep } from '@/steps/FeeStep';
import { OrderStep } from '@/steps/OrderStep';
import { type Checkout, PayStep } from '@/steps/PayStep';
import { RefundStep } from '@/steps/RefundStep';
import { ResultStep } from '@/steps/ResultStep';

const REPOSITORY_URL = 'https://github.com/dgroup-web3/loomgate-examples';

export function App() {
  const [keys, setKeys] = useState<Keys>(loadKeys);
  const [apiBaseUrl, setApiBaseUrl] = useState<string | null>(null);
  const [draft, setDraft] = useState<OrderDraft>(defaultDraft);
  const [checkout, setCheckout] = useState<Checkout | null>(null);
  const [intent, setIntent] = useState<PaymentIntent | null>(null);
  const [refreshToken, setRefreshToken] = useState(0);

  useEffect(() => saveKeys(keys), [keys]);
  useEffect(() => {
    void getConfig().then((config) => setApiBaseUrl(config.apiBaseUrl));
  }, []);

  const built = buildPaymentIntentParams(draft);
  const keyProblem = keysProblem(keys);
  const orderProblem = built.ok ? null : 'Complete the order in step 1.';
  const secretKey = keys.secretKey.trim();
  const refresh = useCallback(() => setRefreshToken((n) => n + 1), []);

  function startOver() {
    setCheckout(null);
    setIntent(null);
    setDraft((current) => ({ ...current, orderReference: newOrderReference() }));
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 pt-6 pb-16">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <img src="/loomgate-logo.svg" alt="Loomgate" className="h-6 dark:hidden" />
          <img src="/loomgate-logo-dark.svg" alt="Loomgate" className="hidden h-6 dark:block" />
          <span className="text-sm font-medium text-muted-foreground">Playground</span>
        </div>
        <a
          href={REPOSITORY_URL}
          className="text-sm underline-offset-4 hover:underline"
          target="_blank"
          rel="noreferrer"
        >
          Example code on GitHub
        </a>
      </header>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Try Loomgate with your own account</h1>
        <p className="mt-1 text-muted-foreground">
          Preview fees, take a card payment, see what you receive and refund it, with the code for each step.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Alert variant="warning">
          <AlertTriangleIcon />
          <AlertTitle>Real money</AlertTitle>
          <AlertDescription>
            There is no test mode: payments charge the card and pay your merchant account. Fees are not refunded. Use a
            small amount, such as 1.00.
          </AlertDescription>
        </Alert>
        <Alert variant="info">
          <ShieldAlertIcon />
          <AlertTitle>For testing only</AlertTitle>
          <AlertDescription>
            This page sends your secret key through this site's server, which never stores it. Never do that in your
            shop: keep the key on your server, as in the examples. Prefer to keep it on your machine?{' '}
            <a href={`${REPOSITORY_URL}#playground`} className="underline" target="_blank" rel="noreferrer">
              Run the playground locally
            </a>
            .
          </AlertDescription>
        </Alert>
      </div>

      <KeysCard keys={keys} onChange={setKeys} />

      <OrderStep draft={draft} built={built} onChange={setDraft} locked={checkout !== null} />
      <FeeStep
        secretKey={secretKey}
        amount={built.ok ? built.params.amount : null}
        currency={draft.currency}
        disabledReason={keyProblem ?? orderProblem}
      />
      <PayStep
        publishableKey={keys.publishableKey}
        secretKey={secretKey}
        apiBaseUrl={apiBaseUrl}
        params={built.ok ? built.params : null}
        disabledReason={keyProblem ?? orderProblem}
        checkout={checkout}
        intentStatus={checkout && intent?.id === checkout.intent.id ? intent.status : null}
        onCheckout={(created) => {
          setCheckout(created);
          setIntent(created.intent);
        }}
        onPaid={refresh}
        onStartOver={startOver}
      />
      <ResultStep
        secretKey={secretKey}
        paymentIntentId={checkout?.intent.id ?? null}
        refreshToken={refreshToken}
        intent={intent}
        onIntent={setIntent}
      />
      <RefundStep secretKey={secretKey} intent={intent} onRefunded={refresh} />
    </div>
  );
}
