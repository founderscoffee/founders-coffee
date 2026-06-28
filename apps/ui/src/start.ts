import { createCsrfMiddleware, createStart } from '@tanstack/react-start';

import { requestContextMiddleware } from '@founders-coffee/server-fns';

/**
 * Global middleware for the UI app (P0-012 → P1-017 linchpin). This `src/start.ts` is
 * auto-discovered by the `tanstackStart()` vite plugin — the virtual server-entry `main`
 * stays as-is. Defining this file disables TanStack's auto-installed CSRF middleware, so
 * `createCsrfMiddleware()` is re-installed explicitly to keep same-origin protection on every
 * server-fn (custom prod origin lands in Phase C). `requestContextMiddleware` gives every
 * server-fn a per-request id in the ALS context the structured logger reads (AGENTS §13).
 */
export default createStart(() => ({
  requestMiddleware: [createCsrfMiddleware()],
  functionMiddleware: [requestContextMiddleware],
}));
