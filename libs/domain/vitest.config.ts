import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'istanbul',
      all: true,
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.fixtures.ts', 'src/geo/data/**'],
      reporter: ['text-summary', 'lcov'],
      thresholds: {
        statements: 99,
        branches: 98,
        functions: 100,
        lines: 100,
      },
    },
  },
});
