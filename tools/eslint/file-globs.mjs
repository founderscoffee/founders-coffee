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
 * Where `console` is the output rather than a stray debug print, so `no-console` cannot apply.
 *
 * `tools/` holds one-shot CLI scripts: what they print IS their interface, and they run on Node
 * outside any Worker, where the structured logger has no transport bound. `transports.ts` is the
 * logger's own console sink — the rule cannot ban the call it redirects everything to. A test
 * prints only through a fake it built itself, and ships nowhere.
 *
 * Product code says things through the structured logger (AGENTS.md §5). The dev-only OTP, SMS and
 * push providers are the deliberate exception and carry an inline justification at each call
 * instead of a glob here: they print a secret that must never enter the log pipeline, because
 * `sanitize` would redact it and Logpush would keep whatever survived.
 */
export const CONSOLE_ALLOWED = [
  'tools/**/*.mjs',
  'tools/**/*.ts',
  'libs/observability/src/transports.ts',
  '**/*.test.ts',
  '**/*.test.tsx',
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
 * The components that own the status roles. A `role="alert"` or `role="status"` written anywhere
 * else is a status message built by hand, which is how they came to say their severity in colour
 * alone; `local/no-bare-status-role` refuses those everywhere but here.
 */
export const STATUS_COMPONENTS = [
  'libs/ui/src/components/LoadingStatus.tsx',
  'libs/ui/src/components/StatusMessage.tsx',
  'libs/ui/src/components/Toast.tsx',
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
  '**/.e2e',
  'libs/i18n/src/paraglide/**',
  '**/worker-configuration.d.ts',
];
