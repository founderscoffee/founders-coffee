import '@founders-coffee/observability/server-init';
import handler from '@tanstack/react-start/server-entry';

import { withSecurityHeaders } from '@founders-coffee/core';
import { logger } from '@founders-coffee/observability';

import type { AuthEnv } from '@founders-coffee/auth';

import { type AdminEnv } from './access-guard.js';
import { resolveAdminContext } from './admin-context.js';

interface AdminWorkerEnv extends AdminEnv, AuthEnv {
  CSP_ENFORCED?: string;
}

export default {
  /**
   * The admin Worker carries the same headers as the public app, including every 403 the guard
   * returns. A forbidden response is still a response a browser renders, so it gets the same policy.
   *
   * Every request is resolved to a correlated admin identity before the app sees it. Doing it at the
   * entry rather than per route means a route added later is protected by existing rather than by
   * remembering, which is the failure mode an admin surface cannot afford.
   *
   * Both identity keys are logged on every admitted request, which is the audit trail CO-04 asks for
   * in its smallest honest form: an operator action is attributable from the first request rather
   * than from whenever the operations surfaces land. The email is deliberately absent — the Access
   * subject and the Better Auth user id identify the operator without putting an address in a log.
   *
   * Admin loads none of the three third-party integrations, so nothing is added to the shared policy.
   */
  fetch: async (request: Request, env: AdminWorkerEnv): Promise<Response> => {
    const secure = (response: Response): Response =>
      withSecurityHeaders(response, {
        enforceCsp: env.CSP_ENFORCED === 'true',
      });

    const admin = await resolveAdminContext(request, env);
    if (!admin.ok) return secure(admin.response);

    logger.info('admin.request', {
      accessSubject: admin.context.accessSubject,
      userId: admin.context.userId,
      role: admin.context.role,
      path: new URL(request.url).pathname,
    });

    return secure(await handler.fetch(request));
  },
} satisfies ExportedHandler<AdminWorkerEnv>;
