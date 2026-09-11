import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['@founders-coffee/source'],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
