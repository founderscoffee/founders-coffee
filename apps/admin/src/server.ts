import '@founders-coffee/observability/server-init';
import handler from '@tanstack/react-start/server-entry';

import { withSecurityHeaders } from '@founders-coffee/core';
import { logger } from '@founders-coffee/observability';

import type { AuthEnv } from '@founders-coffee/auth';

import { createAuthHandler } from '@founders-coffee/auth';

import { forbidden, verifyAccessJwt, type AdminEnv } from './access-guard.js';
import {
  authRequestIsForSelf,
  needsAdminSession,
  resolveAdminContext,
} from './admin-context.js';
import { createAdminOtpEmailProvider } from './lib/auth-email.js';

interface AdminWorkerEnv extends AdminEnv, AuthEnv {
  EMAIL?: SendEmail;
  MAIL_FROM?: string;
  CSP_ENFORCED?: string;
}

/**
 * Better Auth for the admin origin, built per request — never a module singleton, for the D1
 * write-lock reason `libs/server-fns/src/auth.ts` documents.
 *
 * `APP_URL` is this origin, so the session cookie Better Auth issues is host-scoped to admin. That
 * is the property CO-04 asks for and it costs nothing: a cookie widened to `.founders.coffee` would
 * ride along on every request to the public app, and an operator session is the last thing that
 * should be reachable from an origin Access does not stand in front of.
 *
 * Localhost keeps the library's console provider so a code is visible without a mail binding; every
 * deployed environment mails it and never logs it.
 */
const authHandler = (env: AdminWorkerEnv) => {
  const isDev = env.APP_URL.startsWith('http://localhost');
  const emailProvider =
    !isDev && env.EMAIL
      ? createAdminOtpEmailProvider(env.EMAIL, env.MAIL_FROM ?? '')
      : undefined;
  return createAuthHandler(env, emailProvider ? { emailProvider } : {});
};

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

    const url = new URL(request.url);

    if (!needsAdminSession(url.pathname)) {
      const access = await verifyAccessJwt(request, env);
      if (!access.ok) return secure(access.response);
      if (!url.pathname.startsWith('/api/auth/'))
        return secure(await handler.fetch(request));

      if (!(await authRequestIsForSelf(request, access.identity.email)))
        return secure(
          forbidden('Sign in with the address Access verified, or not at all'),
        );

      return secure(await authHandler(env)(request));
    }

    const admin = await resolveAdminContext(request, env);
    if (!admin.ok) return secure(admin.response);

    logger.info('admin.request', {
      accessSubject: admin.context.accessSubject,
      userId: admin.context.userId,
      role: admin.context.role,
      path: url.pathname,
    });

    return secure(await handler.fetch(request));
  },
} satisfies ExportedHandler<AdminWorkerEnv>;
