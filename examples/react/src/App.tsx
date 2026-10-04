import { CheckoutPage } from './pages/CheckoutPage';
import { OrderPage } from './pages/OrderPage';

/** Two pages, no router needed: /order?payment_intent=… and everything else is the checkout. */
export function App() {
  return (
    <main className="mx-auto max-w-xl px-4 pt-8 pb-16">
      <header className="mb-6 flex items-center justify-between gap-3">
        <a href="/">
          <img src="/loomgate-logo.svg" alt="Loomgate" className="h-6 dark:hidden" />
          <img src="/loomgate-logo-dark.svg" alt="Loomgate" className="hidden h-6 dark:block" />
        </a>
        <span className="text-sm text-muted-foreground">Example shop · React SDK</span>
      </header>
      {window.location.pathname === '/order' ? <OrderPage /> : <CheckoutPage />}
    </main>
  );
}
