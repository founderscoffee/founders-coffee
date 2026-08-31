import path from 'node:path';

import {
  cloudflareTest,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

/**
 * libs/auth tests run against a REAL local D1 (Miniflare) — never a mock
 * (AGENTS.md §12). The identity tables come from `libs/db/migrations` (the
 * single migration source); `setup.ts` applies them before tests.
 */
export default defineConfig(async () => {
  const migrationsPath = path.join(__dirname, '../db/migrations');
  const migrations = await readD1Migrations(migrationsPath);
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
