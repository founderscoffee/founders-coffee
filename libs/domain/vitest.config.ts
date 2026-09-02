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
        statements: 59,
        branches: 40,
        functions: 40,
        lines: 63,
      },
    },
  },
});
