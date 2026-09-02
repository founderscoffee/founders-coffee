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
        statements: 65,
        branches: 45,
        functions: 44,
        lines: 68,
      },
    },
  },
});
