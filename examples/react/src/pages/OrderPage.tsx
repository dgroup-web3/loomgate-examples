/**
 * The order page. It asks this shop's server for the payment status. `processing` is not paid yet: the page checks
 * again for up to a minute. Your server should fulfil the order only once the status is `succeeded`.
 */
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatAmount, getOrder, type Order } from '@/lib/api';

const TITLES: Record<Order['status'], string> = {
  succeeded: 'Thank you, your payment succeeded',
  processing: 'Your payment is processing',
  pending: 'Your payment is not complete',
  canceled: 'Your payment was canceled',
};

const BADGES = {
  succeeded: 'success',
  processing: 'warning',
  pending: 'warning',
  canceled: 'destructive',
} as const;

export function OrderPage() {
  const paymentIntentId = new URLSearchParams(window.location.search).get('payment_intent');
  const [order, setOrder] = useState<Order | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!paymentIntentId) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;
    async function refresh(attempt: number) {
      try {
        const loaded = await getOrder(paymentIntentId!);
        if (stopped) return;
        setOrder(loaded);
        if (loaded.status === 'processing' && attempt < 30) timer = setTimeout(() => void refresh(attempt + 1), 2000);
      } catch (err) {
        if (!stopped) setError((err as Error).message);
      }
    }
    void refresh(0);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [paymentIntentId]);

  const title = !paymentIntentId
    ? 'No order to show'
    : error
      ? 'We could not load your order'
      : order
        ? TITLES[order.status]
        : 'Checking your payment…';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {error && <CardDescription>{error}</CardDescription>}
        {order?.status === 'processing' && <CardDescription>This page updates by itself.</CardDescription>}
        {order?.status === 'pending' && <CardDescription>You were not charged.</CardDescription>}
      </CardHeader>
      <CardContent>
        {order && (
          <dl className="grid grid-cols-[max-content_1fr] gap-x-4 gap-y-1.5">
            <dt className="text-muted-foreground">Status</dt>
            <dd>
              <Badge variant={BADGES[order.status]}>{order.status}</Badge>
            </dd>
            <dt className="text-muted-foreground">Amount</dt>
            <dd>{formatAmount(order.amountTotal, order.currency)}</dd>
            <dt className="text-muted-foreground">Order</dt>
            <dd className="break-all">{order.orderReference ?? '—'}</dd>
            <dt className="text-muted-foreground">Payment</dt>
            <dd className="break-all">{order.id}</dd>
          </dl>
        )}
        <a href="/" className={buttonVariants({ variant: 'outline', className: 'mt-4' })}>
          Back to the shop
        </a>
      </CardContent>
    </Card>
  );
}
