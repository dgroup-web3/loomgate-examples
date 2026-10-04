import { defineConfig } from 'vitest/config';

// Kept apart from vite.config.ts: the Worker routes are tested with Hono's app.request(), no Workers runtime needed.
export default defineConfig({
  resolve: { alias: { '@': '/src' } },
  test: { include: ['worker/**/*.test.ts', 'src/**/*.test.ts'] },
});
