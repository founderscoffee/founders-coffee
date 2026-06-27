import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

/**
 * apps/worker-jobs tests run against REAL Miniflare bindings (AGENTS.md §12): send_email for
 * NOTIFICATIONS, D1 for RECONCILE (setup added in the same commit). Workers AI / Vectorize are
 * remote-proxy only in Miniflare, so the EMBEDDINGS consumer's AI/Vectorize calls are unit-tested
 * via injected port fakes (see jobs/embeddings.test.ts) — never env.AI/env.VECTOR.
 */
export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: './wrangler.test.jsonc' } })],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
