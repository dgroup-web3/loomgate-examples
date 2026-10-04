import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig } from 'vite';

// `pnpm dev` serves the pages and runs worker/index.ts in the Workers runtime, on one origin.
export default defineConfig({
  plugins: [cloudflare()],
  environments: {
    // Two HTML pages. Set on the browser build only: the Worker has its own entry (wrangler.jsonc `main`).
    client: {
      build: { rolldownOptions: { input: { checkout: 'index.html', order: 'order.html' } } },
    },
  },
});
