import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'ci/**/*.test.mjs',
      'deploy/**/*.test.mjs',
      'dev-seed/**/*.test.mjs',
      'eslint/**/*.test.mjs',
      'geo/**/*.test.mjs',
      'release/**/*.test.mjs',
      'local-state/**/*.test.mjs',
      'mutants/**/*.test.mjs',
      'seo/**/*.test.mjs',
    ],
    root: __dirname,
  },
});
