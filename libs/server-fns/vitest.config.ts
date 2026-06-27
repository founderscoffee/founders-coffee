import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

/**
 * libs/server-fns tests run in the Workers pool (Miniflare). The request-context
 * + authz logic is exercised directly (real crypto.randomUUID + the observability
 * ALS logger); no Cloudflare bindings are mocked (AGENTS.md §12).
 */
export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.test.jsonc' },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts'],
  },
});
