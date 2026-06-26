import { defineWorkspace } from 'vitest/config';

/**
 * Root Vitest workspace. Each Nx project owns its own `vitest.config.ts`;
 * this lets `vitest` run from the repo root across all projects.
 * `nx run-many -t test` runs each project's test target via @nx/vite.
 *
 * Per-project environments:
 *   - libs/core, libs/domain, ...     → node (pure TS)
 *   - libs/ui, apps/* (components)    → jsdom (DOM)
 *   - apps/* server-fn / Worker tests → @cloudflare/vitest-pool-workers (Miniflare)
 */
export default defineWorkspace([
  'apps/*/vitest.config.ts',
  'libs/*/vitest.config.ts',
]);
