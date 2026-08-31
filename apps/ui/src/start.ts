import { createCsrfMiddleware, createStart } from '@tanstack/react-start';

import { requestContextMiddleware } from '@founders-coffee/server-fns/request-context';

/**
 * Global middleware for the UI app (P0-012 → P1-017 linchpin). This `src/start.ts` is
 * auto-discovered by the `tanstackStart()` vite plugin — the virtual server-entry `main`
 * stays as-is. Defining this file disables TanStack's auto-installed CSRF middleware, so
 * `createCsrfMiddleware()` is re-installed explicitly to keep same-origin protection on every
 * server-fn (custom prod origin lands in Phase C). `requestContextMiddleware` gives every
 * server-fn a per-request id in the ALS context the structured logger reads (AGENTS §13).
 *
 * CSRF allows `Sec-Fetch-Site: none` alongside `same-origin` so direct browser navigations
 * (typed URLs, bookmarks, inbound links) are not rejected with `403 Forbidden`. The default
 * (`same-origin` only) blocks the very first page load, since browsers send `none` + no
 * `Origin` on those. State-changing server-fns remain protected (POST + Sec-Fetch-Mode).
 *
 * Both `default` and `startInstance` exports are required:
 * - `default` is the legacy TanStack Start export
 * - `startInstance` is the named export expected by `@tanstack/start-client-core`'s hydrateStart
 */
const app = createStart(() => ({
  requestMiddleware: [
    createCsrfMiddleware({ secFetchSite: ['none', 'same-origin'] }),
  ],
  functionMiddleware: [requestContextMiddleware],
}));

export const startInstance = app;
export default app;
