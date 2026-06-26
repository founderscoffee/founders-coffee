import { defineConfig } from 'vitest/config';

/**
 * libs/core test config. Pure-TS library → node environment.
 * (React component libs, e.g. libs/ui, use `environment: 'jsdom'`;
 *  Workers integration tests use `@cloudflare/vitest-pool-workers`.)
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
