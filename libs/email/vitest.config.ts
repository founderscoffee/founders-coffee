import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

/**
 * libs/email tests run against the REAL Miniflare `EMAIL` (send_email) binding — never mocked
 * (AGENTS.md §12). No D1 → no migrations / setup file. The render/template tests exercise the
 * pure React Email pipeline in-pool (react-dom/server — proven by apps/web SSR).
 */
export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.test.jsonc' } })],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
