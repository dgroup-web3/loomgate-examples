/**
 * The checkout page, with the Loomgate JavaScript SDK from npm.
 *
 * 1. Load the SDK with the publishable key.
 * 2. "Continue to payment": the server prices the cart and creates a payment intent → client secret.
 * 3. Mount the card form with that client secret.
 * 4. "Pay": confirm() straight from the click handler, then go to the order page.
 */
import { type BillingDetails, loadLoomgate, type PaymentSession } from '@loompay/loomgate-js-sdk';
import { type Catalog, type CheckoutRequest, formatAmount, getCatalog, getConfig, startCheckout } from './api';

const form = document.querySelector<HTMLFormElement>('#details-form')!;
const productsEl = document.querySelector<HTMLDivElement>('#products')!;
const cartTotalEl = document.querySelector<HTMLSpanElement>('#cart-total')!;
const continueButton = document.querySelector<HTMLButtonElement>('#continue')!;
const paymentSection = document.querySelector<HTMLElement>('#payment')!;
const payButton = document.querySelector<HTMLButtonElement>('#pay')!;
const editButton = document.querySelector<HTMLButtonElement>('#edit')!;
const errorEl = document.querySelector<HTMLParagraphElement>('#error')!;

let catalog: Catalog | null = null;
let session: PaymentSession | null = null;
let paymentIntentId: string | null = null;
/** Read when the buyer presses Continue: the inputs are disabled afterwards, and FormData skips disabled inputs. */
let details: ReturnType<typeof readForm> | null = null;

function showError(message: string | null) {
  errorEl.textContent = message ?? '';
  errorEl.hidden = message === null;
}

const config = await getConfig().catch((error: Error) => {
  showError(`${error.message} Set the keys in .dev.vars (see README).`);
  throw error;
});

// Load once per page. The promise rejects on a bad key or when the card form cannot load.
const loomgatePromise = loadLoomgate(config.publishableKey, { apiBaseUrl: config.apiBaseUrl });

try {
  catalog = await getCatalog();
  renderProducts(catalog);
} catch (error) {
  showError((error as Error).message);
}

function renderProducts({ products, currency }: Catalog) {
  productsEl.replaceChildren(
    ...products.map((product, index) => {
      const row = document.createElement('label');
      row.className = 'product';
      const name = document.createElement('span');
      name.textContent = `${product.name} · ${formatAmount(product.unitAmount, currency)}`;
      const quantity = document.createElement('input');
      quantity.type = 'number';
      quantity.min = '0';
      quantity.max = '10';
      quantity.value = index === 0 ? '1' : '0';
      quantity.dataset.productId = product.id;
      quantity.setAttribute('aria-label', `Quantity of ${product.name}`);
      quantity.addEventListener('input', updateTotal);
      row.append(name, quantity);
      return row;
    }),
  );
  updateTotal();
}

function cartLines() {
  return [...productsEl.querySelectorAll<HTMLInputElement>('input[data-product-id]')]
    .map((input) => ({ id: input.dataset.productId!, quantity: Number(input.value) }))
    .filter((line) => line.quantity > 0);
}

/** Display only: the server computes the amount that is charged. */
function updateTotal() {
  if (!catalog) return;
  const { products, currency } = catalog;
  const total = cartLines().reduce(
    (sum, line) => sum + (products.find((p) => p.id === line.id)?.unitAmount ?? 0) * line.quantity,
    0,
  );
  cartTotalEl.textContent = formatAmount(total, currency);
}

function readForm() {
  const data = new FormData(form);
  const value = (name: string) => String(data.get(name) ?? '').trim();
  return {
    email: value('email'),
    name: value('name'),
    line1: value('line1'),
    line2: value('line2'),
    city: value('city'),
    state: value('state'),
    postal_code: value('postal_code'),
    country: value('country').toUpperCase(),
  };
}

function setDetailsLocked(locked: boolean) {
  for (const input of form.querySelectorAll('input')) input.disabled = locked;
  continueButton.hidden = locked;
  paymentSection.hidden = !locked;
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  showError(null);
  details = readForm();
  const request: CheckoutRequest = {
    cart: cartLines(),
    customer: { name: details.name },
    shipping: {
      line1: details.line1,
      line2: details.line2,
      city: details.city,
      state: details.state,
      postal_code: details.postal_code,
      country: details.country,
    },
  };

  continueButton.disabled = true;
  try {
    const checkout = await startCheckout(request);
    paymentIntentId = checkout.paymentIntentId;
    setDetailsLocked(true);
    await mountCardForm(checkout.clientSecret);
  } catch (error) {
    // A session that failed to mount is dropped: the next "Continue" starts over with a new one.
    session?.destroy();
    session = null;
    showError((error as Error).message);
    setDetailsLocked(false);
  } finally {
    continueButton.disabled = false;
  }
});

async function mountCardForm(clientSecret: string) {
  const loomgate = await loomgatePromise;
  session = loomgate.payment({ clientSecret });

  session.on('change', ({ complete, amountTotal, currency }) => {
    payButton.disabled = !complete;
    // The amount the card form will charge. Always display this one.
    if (amountTotal !== null && currency) payButton.textContent = `Pay ${formatAmount(amountTotal, currency)}`;
  });
  session.on('error', (error) => showError(error.message));

  await session.mount({ payment: '#loomgate-payment', branding: '#loomgate-branding' });
}

payButton.addEventListener('click', () => {
  if (!session || !paymentIntentId || !details) return;
  const billingDetails: BillingDetails = {
    email: details.email,
    name: details.name,
    address: {
      line1: details.line1,
      line2: details.line2 || undefined,
      city: details.city || undefined,
      state: details.state || undefined,
      postal_code: details.postal_code,
      country: details.country,
    },
  };
  const orderUrl = new URL(`/order.html?payment_intent=${encodeURIComponent(paymentIntentId)}`, window.location.origin);

  payButton.disabled = true;
  showError(null);
  // Call confirm() directly in the click handler, with no `await` before it: wallets need the click's user activation.
  session
    .confirm({
      billingDetails,
      // Where the buyer comes back after a 3-D Secure redirect. Must be https://.
      returnUrl: orderUrl.protocol === 'https:' ? orderUrl.href : undefined,
    })
    .then((result) => {
      if (result.error) {
        // Neutral English, safe to show. The buyer can fix the card and press Pay again.
        showError(result.error.message);
        payButton.disabled = false;
        return;
      }
      // 'succeeded' or 'processing'. The order page reads the final status from the server.
      window.location.assign(orderUrl.href);
    });
});

editButton.addEventListener('click', () => {
  // A destroyed session cannot be mounted again. The next "Continue" creates a new payment intent.
  session?.destroy();
  session = null;
  paymentIntentId = null;
  payButton.textContent = 'Pay';
  payButton.disabled = true;
  showError(null);
  setDetailsLocked(false);
});
