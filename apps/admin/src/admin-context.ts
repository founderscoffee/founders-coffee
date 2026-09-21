import {
  ADMIN_APP_PERMISSION,
  createAuth,
  getSession,
  roleAllows,
  type AuthEnv,
} from '@founders-coffee/auth';

import { forbidden, verifyAccessJwt, type AdminEnv } from './access-guard.js';

export interface AdminContext {
  readonly accessSubject: string;
  readonly accessEmail: string;
  readonly userId: string;
  readonly role: string;
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
 * a claim it does not make cannot be trusted from the token. What that role may do is asked of the
 * central table, never compared here: AGENTS.md §10 forbids ad hoc role comparisons, and this function used
 * to contain one.
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

  if (typeof role !== 'string' || !roleAllows(role, ADMIN_APP_PERMISSION))
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

export const ADMIN_LOGIN_PATH = '/login';

const SESSION_FREE_PREFIXES = ['/api/auth/'] as const;

/**
 * Whether this path may be served to somebody Access let in but who is not yet signed in.
 *
 * Sign-in is the one thing an operator cannot already be signed in to do, so requiring a correlated
 * session everywhere would lock the door with the key inside. The exemption is deliberately two
 * paths and an allowlist, never a denylist: a route added later is guarded by default, and making it
 * public is a visible edit here rather than an omission somewhere else.
 *
 * Access still gates both. Nothing in this app is reachable without passing the policy first — the
 * exemption is from the session, not from Cloudflare.
 *
 * Server functions are not exempt. `/_serverFn/*` carries the operations mutations CO-08 and CO-09
 * will add, and none of those has a reason to run for an unauthenticated caller.
 */
export const needsAdminSession = (pathname: string): boolean => {
  if (pathname === ADMIN_LOGIN_PATH) return false;
  return !SESSION_FREE_PREFIXES.some((prefix) => pathname.startsWith(prefix));
};

/**
 * Refuse an auth request that names somebody other than the person Access vouched for.
 *
 * Without this, every endpoint under `/api/auth/` will happily send a sign-in code to whatever
 * address the body carries. The caller is already behind the Access policy, so the blast radius is
 * one allowlisted operator — but that operator can point the admin origin at any mailbox in the
 * world, and "our admin panel emailed me a code" is a convincing thing to receive.
 *
 * Pinning the address to the Access identity removes the vector rather than rate-limiting it, and it
 * makes the correlation true earlier: an operator can only ever begin signing in as themselves, so
 * the mismatch that `resolveAdminContext` would catch on the next request cannot be created here.
 *
 * A body with no email is left alone — sign-out and session reads carry none, and inventing a
 * requirement for them would break the handler. Unparseable bodies are left alone too: they are the
 * handler's to reject, and guessing at them here would be a second parser disagreeing with the first.
 */
export const authRequestIsForSelf = async (
  request: Request,
  accessEmail: string,
): Promise<boolean> => {
  if (request.method !== 'POST') return true;
  let body: unknown;
  try {
    body = await request.clone().json();
  } catch {
    return true;
  }
  const email = (body as { email?: unknown } | null)?.email;
  if (typeof email !== 'string' || email.length === 0) return true;
  return sameEmail(email, accessEmail);
};
