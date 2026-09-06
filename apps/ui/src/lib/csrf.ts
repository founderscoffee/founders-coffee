const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * True when the request may change state and therefore has to pass the CSRF check.
 *
 * Read-only methods are excluded so that cross-site *navigations* still render: an OAuth
 * provider redirecting back to `/api/auth/callback/<provider>` — and onward into the app —
 * sends `Sec-Fetch-Site: cross-site`, which the site-based check rejects. Without this
 * exclusion every social sign-in ends on a bare `403 Forbidden` page even though the session
 * cookie was set correctly. `OPTIONS` is safe by definition; a CORS preflight has no effects.
 */
export const isStateChangingRequest = (request: Request): boolean =>
  !SAFE_METHODS.has(request.method.toUpperCase());
