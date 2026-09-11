import { createAuth, getSession, type AuthEnv } from '@founders-coffee/auth';

import { forbidden, verifyAccessJwt, type AdminEnv } from './access-guard.js';

export const ADMIN_ROLES = ['admin', 'moderator'] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

export interface AdminContext {
  readonly accessSubject: string;
  readonly accessEmail: string;
  readonly userId: string;
  readonly role: AdminRole;
}

export type AdminContextResult =
  | { readonly ok: true; readonly context: AdminContext }
  | { readonly ok: false; readonly response: Response };

type AdminWorkerEnv = AdminEnv & AuthEnv;

export interface AdminContextDeps {
  readonly resolveSession?: (
    request: Request,
    env: AdminWorkerEnv,
  ) => Promise<{ user?: unknown } | null>;
}

/**
 * Read the signed-in account from the request.
 *
 * Constructed per request and never cached at module scope, for the D1 write-lock reason
 * `libs/server-fns/src/auth.ts` documents. It is reachable through {@link AdminContextDeps} so the
 * correlation can be tested without booting Better Auth and a database around it.
 */
const defaultResolveSession = async (
  request: Request,
  env: AdminWorkerEnv,
): Promise<{ user?: unknown } | null> => {
  const { auth } = createAuth(env);
  return getSession(auth, request.headers);
};

/**
 * Emails differ in case and still name one mailbox.
 *
 * Cloudflare returns the address as the identity provider spelled it and Better Auth stores what the
 * member typed at sign-up. Comparing them raw would refuse `Founder@…` against `founder@…`, which is
 * one person, and the refusal would look like the correlation working rather than failing.
 */
const sameEmail = (a: string, b: string): boolean =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

const isAdminRole = (role: unknown): role is AdminRole =>
  typeof role === 'string' && ADMIN_ROLES.includes(role as AdminRole);

/**
 * Who is making this request, proved twice and the two proofs agreeing.
 *
 * Access says a browser got past the policy. A Better Auth session says an account is signed in on
 * this origin. Neither alone is an admin: Access does not know about roles, and a session cookie
 * says nothing about whether Cloudflare let that browser in. Requiring both, **and requiring them to
 * name the same person**, is what closes the gap this ticket exists for — a valid Access identity
 * paired with somebody else's valid session is the attack it refuses, and it is refused here rather
 * than in each server function, where one missed call site would be the whole hole.
 *
 * Fails closed at every step, and says which step in the body: an operator reading a 403 needs to
 * know whether Access, the session, the role or the correlation stopped them, and none of those
 * strings tells an attacker anything they could not learn by trying.
 *
 * The role is read from the session rather than from Access, because Access has no notion of one and
 * a claim it does not make cannot be trusted from the token.
 */
export const resolveAdminContext = async (
  request: Request,
  env: AdminWorkerEnv,
  deps: AdminContextDeps = {},
): Promise<AdminContextResult> => {
  const access = await verifyAccessJwt(request, env);
  if (!access.ok) return access;

  const session = await (deps.resolveSession ?? defaultResolveSession)(
    request,
    env,
  );
  if (!session) return { ok: false, response: forbidden('No admin session') };

  const { email, id, role } = (session.user ?? {}) as {
    email?: string;
    id?: string;
    role?: unknown;
  };
  if (!email || !id)
    return { ok: false, response: forbidden('Session carries no identity') };

  if (!sameEmail(access.identity.email, email))
    return {
      ok: false,
      response: forbidden(
        'Access identity does not match the signed-in account',
      ),
    };

  if (!isAdminRole(role))
    return { ok: false, response: forbidden('Account is not an operator') };

  return {
    ok: true,
    context: {
      accessSubject: access.identity.subject,
      accessEmail: access.identity.email,
      userId: id,
      role,
    },
  };
};
