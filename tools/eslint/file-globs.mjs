export const TS_FILES = ['**/*.ts', '**/*.tsx', '**/*.mts', '**/*.cts'];

export const JS_FILES = ['**/*.js', '**/*.jsx', '**/*.cjs', '**/*.mjs'];

export const ALL_FILES = [...TS_FILES, ...JS_FILES];

export const CONFIG_FILES = [
  '**/*.config.ts',
  '**/*.config.mts',
  '**/*.config.cts',
  '**/*.config.js',
  '**/*.config.mjs',
  '**/*.config.cjs',
  'vitest.workspace.ts',
];

/**
 * Files another rule requires to be a single file, so `max-lines` cannot apply. Nothing else
 * belongs here: a file that is merely large must be split (AGENTS.md §5).
 */
export const MAX_LINES_EXEMPT = [
  'libs/domain/src/geo/data/*.ts',
  'libs/db/src/schema.ts',
];

/**
 * Mirrors what the project tsconfigs exclude. Type-aware rules need a file to belong to a TS
 * project, and tests, fixtures, config and setup files deliberately sit outside them.
 */
export const UNTYPED_FILES = [
  '**/*.test.ts',
  '**/*.test.tsx',
  '**/*.spec.ts',
  '**/*.spec.tsx',
  '**/*.fixtures.ts',
  '**/*.config.ts',
  '**/*.config.mts',
  '**/setup.ts',
  '**/e2e/**',
  'vitest.workspace.ts',
];

export const IGNORED = [
  '**/dist',
  '**/out-tsc',
  'libs/i18n/src/paraglide/**',
  '**/worker-configuration.d.ts',
];
