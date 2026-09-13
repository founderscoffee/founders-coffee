import path from 'node:path';

import {
  cloudflareTest,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers';
import viteReact from '@vitejs/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { defineConfig } from 'vitest/config';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    path.join(__dirname, '../../libs/db/migrations'),
  );
  return {
    plugins: [
      tanstackStart(),
      viteReact(),
      cloudflareTest({
        wrangler: { configPath: './wrangler.test.jsonc' },
        miniflare: { bindings: { TEST_MIGRATIONS: migrations } },
      }),
    ],
    test: {
      include: ['integration/**/*.test.ts'],
      setupFiles: ['./integration/setup.ts'],
      testTimeout: 30_000,
    },
  };
});
