// The order page. It asks this shop's server for the payment status. `processing` is not paid yet: the page checks
// again for up to a minute. Your server should fulfil the order only once the status is `succeeded`.
import { formatAmount, getOrder } from './api.js';

const titleEl = document.querySelector('#title');
const messageEl = document.querySelector('#message');
const detailsEl = document.querySelector('#details');

const TITLES = {
  succeeded: 'Thank you, your payment succeeded',
  processing: 'Your payment is processing',
  pending: 'Your payment is not complete',
  canceled: 'Your payment was canceled',
};

const paymentIntentId = new URLSearchParams(window.location.search).get('payment_intent');

async function refresh(attempt = 0) {
  if (!paymentIntentId) {
    titleEl.textContent = 'No order to show';
    return;
  }
  try {
    const order = await getOrder(paymentIntentId);
    render(order);
    if (order.status === 'processing' && attempt < 30) setTimeout(() => void refresh(attempt + 1), 2000);
  } catch (error) {
    titleEl.textContent = 'We could not load your order';
    messageEl.textContent = error.message;
  }
}

function render(order) {
  titleEl.textContent = TITLES[order.status] ?? order.status;
  messageEl.textContent =
    order.status === 'processing'
      ? 'This page updates by itself.'
      : order.status === 'pending'
        ? 'You were not charged.'
        : '';
  const status = document.querySelector('#status');
  status.textContent = order.status;
  status.className = `status ${order.status}`;
  document.querySelector('#amount').textContent = formatAmount(order.amountTotal, order.currency);
  document.querySelector('#order-reference').textContent = order.orderReference ?? '—';
  document.querySelector('#payment-intent').textContent = order.id;
  detailsEl.hidden = false;
}

void refresh();
