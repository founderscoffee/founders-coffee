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
  'libs/domain/src/venues/data/*.ts',
  'libs/db/src/schema.ts',
];

/**
 * Where product copy is written by hand rather than read out of the message catalogue: page
 * content, the components that render it, and the email templates. The catalogue, the web app
 * manifests, `offline.html` and the rendered emails each have their own em-dash guard in a test;
 * this glob is what the lint rule watches, because a string a component builds at runtime —
 * joining a label to a value, say — never passes through any of them.
 *
 * Tests are excluded: an `it('...')` description is not copy.
 */
export const PRODUCT_COPY_FILES = [
  'apps/ui/src/components/**/*.ts',
  'apps/ui/src/components/**/*.tsx',
  'apps/ui/src/features/**/*.ts',
  'apps/ui/src/features/**/*.tsx',
  'apps/ui/src/content/**/*.ts',
  'libs/ui/src/**/*.ts',
  'libs/ui/src/**/*.tsx',
  'libs/email/src/templates/**/*.ts',
  'libs/email/src/templates/**/*.tsx',
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
  '**/coverage',
  'libs/i18n/src/paraglide/**',
  '**/worker-configuration.d.ts',
];
