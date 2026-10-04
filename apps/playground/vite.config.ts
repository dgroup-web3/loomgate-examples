import { cloudflare } from '@cloudflare/vite-plugin';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// `pnpm dev` serves the app and runs worker/index.ts in the Workers runtime, on one origin.
export default defineConfig({
  // A fixed port of its own, so it never collides with another app (5173 is Vite's default).
  server: { port: 5180, strictPort: true },
  preview: { port: 5180, strictPort: true },
  plugins: [react(), tailwindcss(), cloudflare()],
  // `@/…` = `src/…`, as in tsconfig.json (used by the shadcn/ui components).
  resolve: { alias: { '@': '/src' } },
});
