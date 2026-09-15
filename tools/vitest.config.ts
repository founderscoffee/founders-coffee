import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'eslint/**/*.test.mjs',
      'ci/**/*.test.mjs',
      'release/**/*.test.mjs',
      'local-state/**/*.test.mjs',
      'seo/**/*.test.mjs',
    ],
    root: __dirname,
  },
});
