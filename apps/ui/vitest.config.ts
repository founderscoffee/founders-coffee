import { defineConfig } from 'vitest/config';

import { mapboxCspWorker } from './vite-mapbox-worker';

export default defineConfig({
  cacheDir: './node_modules/.vite-vitest',
  plugins: [mapboxCspWorker()],
  resolve: {
    conditions: ['@founders-coffee/source'],
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
