import '@founders-coffee/observability/server-init';
import handler from '@tanstack/react-start/server-entry';

import { verifyAccessJwt, type AdminEnv } from './access-guard.js';

export default {
  fetch: async (request: Request, env: AdminEnv): Promise<Response> => {
    const blocked = await verifyAccessJwt(request, env);
    if (blocked) return blocked;
    return handler.fetch(request);
  },
} satisfies ExportedHandler<AdminEnv>;
