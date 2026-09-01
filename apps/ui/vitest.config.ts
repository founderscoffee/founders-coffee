import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    conditions: ['@founders-coffee/source'],
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
  },
});
