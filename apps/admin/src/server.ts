import '@founders-coffee/observability/server-init';
import handler from '@tanstack/react-start/server-entry';

import { verifyAccessJwt, type AdminEnv } from './access-guard.js';

/**
 * Custom Workers entry for apps/admin.
 *
 * Wraps the TanStack Start server handler with the Cloudflare Access JWT guard:
 * every request is verified before reaching the app. Reachable only through the
 * Access-gated route (`workers_dev: false` in wrangler.jsonc).
 */
export default {
  fetch: async (request: Request, env: AdminEnv): Promise<Response> => {
    const blocked = await verifyAccessJwt(request, env);
    if (blocked) return blocked;
    return handler.fetch(request);
  },
} satisfies ExportedHandler<AdminEnv>;
