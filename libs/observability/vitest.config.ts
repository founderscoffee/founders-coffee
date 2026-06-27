import { cloudflareTest } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

/**
 * libs/observability tests run in the Workers pool (Miniflare) so the metrics
 * tests get a REAL Analytics Engine binding — never a mock (AGENTS.md §12).
 * Pure tests (levels/sanitize/context) run in the same pool; they don't touch env.
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
