import path from 'node:path';

import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

/**
 * libs/server-fns tests run in the Workers pool (Miniflare). Feature services (e.g. markets) read
 * real D1 — `libs/db` migrations are applied in `setup.ts` before tests (AGENTS.md §12 — never mock
 * bindings). The request-context + authz logic is exercised directly too.
 */
export default defineConfig(async () => {
  const migrations = await readD1Migrations(path.join(__dirname, '../db/migrations'));
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
