import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface AdminEnv {
  CF_ACCESS_TEAM_DOMAIN: string;
  CF_ACCESS_AUD: string;
  CF_ACCESS_DISABLED?: string;
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

const forbidden = (message: string): Response =>
  new Response(JSON.stringify({ error: message }), {
    status: 403,
    headers: { 'content-type': 'application/json' },
  });

/**
 * Returns a 403 Response to short-circuit the request, or `null` to allow it
 * through to the app handler.
 */
export const verifyAccessJwt = async (
  request: Request,
  env: AdminEnv,
): Promise<Response | null> => {
  if (env.CF_ACCESS_DISABLED === 'true') return null;

  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) return forbidden('Missing Cf-Access-Jwt-Assertion');

  if (!env.CF_ACCESS_TEAM_DOMAIN || !env.CF_ACCESS_AUD) {
    return forbidden('Access guard misconfigured');
  }

  try {
    await jwtVerify(token, getJwks(env.CF_ACCESS_TEAM_DOMAIN), {
      issuer: `https://${env.CF_ACCESS_TEAM_DOMAIN}`,
      audience: env.CF_ACCESS_AUD,
      algorithms: ['RS256'],
    });
    return null;
  } catch {
    return forbidden('Invalid Access token');
  }
};
