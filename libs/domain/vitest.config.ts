import { defineConfig } from 'vitest/config';

/** Pure-TS domain library → node environment (no Cloudflare bindings). */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
