import { cloudflare } from '@cloudflare/vite-plugin';
import { defineConfig } from 'vite';

// `pnpm dev` serves the pages and runs worker/index.ts in the Workers runtime, on one origin.
export default defineConfig({
  // A fixed port of its own, so it never collides with another app (5173 is Vite's default).
  server: { port: 5181, strictPort: true },
  preview: { port: 5181, strictPort: true },
  plugins: [cloudflare()],
  environments: {
    // Two HTML pages. Set on the browser build only: the Worker has its own entry (wrangler.jsonc `main`).
    client: {
      build: { rolldownOptions: { input: { checkout: 'index.html', order: 'order.html' } } },
    },
  },
});
