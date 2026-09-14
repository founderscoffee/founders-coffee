import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface AdminEnv {
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_AUD: string;
  CF_ACCESS_DISABLED?: string;
  CF_ACCESS_DEV_EMAIL?: string;
}

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let jwksTeamDomain = '';

const getJwks = (teamDomain: string): ReturnType<typeof createRemoteJWKSet> => {
  if (!jwks || jwksTeamDomain !== teamDomain) {
    jwks = createRemoteJWKSet(
      new URL(`https://${teamDomain}/cdn-cgi/access/certs`),
    );
    jwksTeamDomain = teamDomain;
  }
  return jwks;
};

export interface AccessIdentity {
  readonly email: string;
  readonly subject: string;
}

export type AccessResult =
  | { readonly ok: true; readonly identity: AccessIdentity }
  | { readonly ok: false; readonly response: Response };

export const forbidden = (message: string): Response =>
  new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  });

const refuse = (message: string): AccessResult => ({
  ok: false,
  response: forbidden(message),
});

/**
 * The identity Access vouched for, or the refusal to send instead.
 *
 * It used to answer `Response | null` — blocked, or carry on. That was enough while nothing behind
 * it cared *who* had been let through, and CO-04 is the point where something does: the admin
 * context has to prove the Access identity and the Better Auth session are the same person, which
 * it cannot do if the identity is thrown away here.
 *
 * `email` and `sub` are both required. Cloudflare issues an identity token for a browser session and
 * both fields are always present on one; a token without them is a service token or something
 * unexpected, and neither should reach an admin surface. Refusing beats defaulting.
 *
 * `CF_ACCESS_DISABLED` yields a local identity rather than skipping the check, so the code path
 * behind it is the same one production runs. A bypass that also bypasses the correlation would mean
 * the only exercised path in development is the one that never runs anywhere else.
 */
export const verifyAccessJwt = async (
  request: Request,
  env: AdminEnv,
): Promise<AccessResult> => {
  if (env.CF_ACCESS_DISABLED === 'true')
    return {
      ok: true,
      identity: { email: env.CF_ACCESS_DEV_EMAIL ?? '', subject: 'dev' },
    };

  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return refuse('Missing Cf-Access-Jwt-Assertion');

  if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) {
    return refuse('Access guard misconfigured');
  }

  try {
    const { payload } = await jwtVerify(
      token,
      getJwks(env.CF_ACCESS_TEAM_DOMAIN),
      {
        issuer: `https://${env.CF_ACCESS_TEAM_DOMAIN}`,
        audience: env.CF_ACCESS_AUD,
        algorithms: ['RS256'],
      },
    );

    const email = typeof payload.email === 'string' ? payload.email : '';
    const subject = typeof payload.sub === 'string' ? payload.sub : '';
    if (!email || !subject) return refuse('Access token carries no identity');

    return { ok: true, identity: { email, subject } };
  } catch {
    return refuse('Invalid Access token');
  }
};
