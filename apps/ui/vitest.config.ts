import { defineConfig } from 'vitest/config';

import { mapboxCspWorker } from './vite-mapbox-worker';

export default defineConfig({
  plugins: [mapboxCspWorker()],
  resolve: {
    conditions: ['@founders-coffee/source'],
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
