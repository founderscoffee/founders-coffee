export const AUTH_BASE_PATH = '/api/auth';

export const PUBLIC_AUTH_ROUTES = [
  'GET /get-session',
  'POST /email-otp/send-verification-otp',
  'POST /sign-in/email-otp',
  'POST /sign-in/social',
  'GET /callback/google',
  'GET /callback/github',
  'GET /error',
  'POST /sign-out',
] as const;

const SERVED = new Set<string>(PUBLIC_AUTH_ROUTES);

/**
 * Whether a request from the network may reach this Better Auth route.
 *
 * Better Auth mounts every endpoint its plugins define (password reset, phone sign-in, the admin
 * API, session and account management) whether or not this product has a screen for it. The apps
 * call only these: reading the session, signing in with an email code or through Google or GitHub
 * (with the OAuth callback and its error page), and signing out. Every other route answers 404
 * before Better Auth sees it, so an endpoint a plugin adds is closed until someone lists it here.
 *
 * The match is exact, method included. A near miss (a trailing slash, another case, a doubled
 * slash) is refused rather than normalised, because refusing is the safe way to be wrong.
 */
export const isPublicAuthRoute = (pathname: string, method: string): boolean =>
  pathname.startsWith(`${AUTH_BASE_PATH}/`) &&
  SERVED.has(`${method} ${pathname.slice(AUTH_BASE_PATH.length)}`);
