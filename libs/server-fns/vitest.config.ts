import path from 'node:path';

import {
  cloudflareTest,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    path.join(__dirname, '../db/migrations'),
  );
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
      coverage: {
        provider: 'istanbul',
        all: true,
        include: ['src/**/*.ts'],
        exclude: ['src/**/*.test.ts', 'src/**/*.fixtures.ts', 'src/setup.ts'],
        reporter: ['text-summary', 'lcov'],
        thresholds: {
          statements: 69,
          branches: 67,
          functions: 64,
          lines: 70,
        },
      },
    },
  };
});
