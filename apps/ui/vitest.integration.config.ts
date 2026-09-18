import path from 'node:path';

import {
  cloudflareTest,
  readD1Migrations,
} from '@cloudflare/vitest-pool-workers';
import viteReact from '@vitejs/plugin-react';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { defineConfig } from 'vitest/config';

import { mapboxCspWorker } from './vite-mapbox-worker';

export default defineConfig(async () => {
  const migrations = await readD1Migrations(
    path.join(__dirname, '../../libs/db/migrations'),
  );
  return {
    cacheDir: './node_modules/.vite-vitest-integration',
    plugins: [
      tanstackStart(),
      viteReact(),
      mapboxCspWorker(),
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
