import path from 'node:path';

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

/**
 * apps/worker-jobs tests run against REAL Miniflare bindings (AGENTS.md §12): D1 for RECONCILE
 * (migrations applied in setup.ts), send_email for NOTIFICATIONS. Workers AI / Vectorize are
 * remote-proxy only in Miniflare, so the EMBEDDINGS consumer's AI/Vectorize calls are unit-tested
 * via injected port fakes (jobs/embeddings.test.ts) — never env.AI/env.VECTOR.
 */
export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, '../../libs/db/migrations'));
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.test.jsonc' },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
      }),
    ],
    test: {
      include: ['src/**/*.test.ts'],
      setupFiles: ['./src/setup.ts'],
    },
  };
});
