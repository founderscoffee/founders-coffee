import '@founders-coffee/observability/server-init';
import handler from '@tanstack/react-start/server-entry';

import { withSecurityHeaders } from '@founders-coffee/core';

import { verifyAccessJwt, type AdminEnv } from './access-guard.js';

interface AdminWorkerEnv extends AdminEnv {
  CSP_ENFORCED?: string;
}

export default {
  /**
   * The admin Worker carries the same headers as the public app, including the 403 the Access guard
   * returns. A forbidden response is still a response a browser renders, so it gets the same policy.
   *
   * Admin loads none of the three third-party integrations, so nothing is added to the shared policy.
   */
  fetch: async (request: Request, env: AdminWorkerEnv): Promise<Response> => {
    const secure = (response: Response): Response =>
      withSecurityHeaders(response, {
        enforceCsp: env.CSP_ENFORCED === 'true',
      });

    const blocked = await verifyAccessJwt(request, env);
    if (blocked) return secure(blocked);
    return secure(await handler.fetch(request));
  },
} satisfies ExportedHandler<AdminWorkerEnv>;
