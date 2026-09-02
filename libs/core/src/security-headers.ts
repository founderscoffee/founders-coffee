export interface SecurityHeaderOptions {
  readonly enforceCsp?: boolean;
  readonly reportPath?: string;
  readonly extraSources?: Readonly<Record<string, readonly string[]>>;
}

const SELF = "'self'";
const NONE = "'none'";

const TURNSTILE = 'https://challenges.cloudflare.com';

const MAPBOX_API = 'https://api.mapbox.com';
const MAPBOX_EVENTS = 'https://events.mapbox.com';
const MAPBOX_TILES = 'https://*.tiles.mapbox.com';

const FIREBASE_INSTALLATIONS = 'https://firebaseinstallations.googleapis.com';
const FCM_REGISTRATIONS = 'https://fcmregistrations.googleapis.com';

const BASE_DIRECTIVES: Readonly<Record<string, readonly string[]>> = {
  'default-src': [SELF],
  'script-src': [SELF, TURNSTILE],
  'style-src': [SELF, "'unsafe-inline'"],
  'img-src': [SELF, 'data:', 'blob:', MAPBOX_API, MAPBOX_TILES],
  'font-src': [SELF, 'data:'],
  'connect-src': [
    SELF,
    TURNSTILE,
    MAPBOX_API,
    MAPBOX_EVENTS,
    MAPBOX_TILES,
    FIREBASE_INSTALLATIONS,
    FCM_REGISTRATIONS,
  ],
  'frame-src': [TURNSTILE],
  'worker-src': [SELF, 'blob:'],
  'manifest-src': [SELF],
  'base-uri': [NONE],
  'form-action': [SELF],
  'frame-ancestors': [NONE],
  'object-src': [NONE],
};

const mergeSources = (
  extra: SecurityHeaderOptions['extraSources'],
): Record<string, readonly string[]> => {
  const merged: Record<string, readonly string[]> = { ...BASE_DIRECTIVES };
  for (const [directive, sources] of Object.entries(extra ?? {})) {
    merged[directive] = [...(merged[directive] ?? []), ...sources];
  }
  return merged;
};

/**
 * The shared Content-Security-Policy, one entry per directive.
 *
 * Every third-party source is one of the three approved integrations and is listed for a reason
 * that can be checked against the built bundle:
 *
 * - Turnstile serves its challenge script from `challenges.cloudflare.com` and renders it in an
 *   iframe, so it needs both `script-src` and `frame-src`.
 * - Mapbox GL fetches styles and geocoding from `api.mapbox.com`, telemetry from
 *   `events.mapbox.com`, and raster tiles from `*.tiles.mapbox.com`. It also builds its renderer in
 *   a worker created from a blob, which is why `worker-src` allows `blob:`, and draws tiles through
 *   canvas images, which is why `img-src` allows `blob:` and `data:`.
 * - Firebase messaging registers a token against `firebaseinstallations.googleapis.com` and
 *   `fcmregistrations.googleapis.com`. The SDK itself is bundled, so no script source is needed.
 *
 * Two deliberate weakenings, recorded rather than hidden:
 *
 * - `style-src` allows `'unsafe-inline'`. React writes inline `style` attributes and the streaming
 *   SSR inserts a style element before hydration; without it the first paint is unstyled. Removing
 *   it needs a style nonce threaded through the same path as the script nonce.
 * - `script-src` carries no `'unsafe-inline'` **and** no nonce yet. That combination is why the
 *   policy ships report-only: TanStack emits three inline scripts and its nonce option lives on
 *   `router.options.ssr.nonce`, inside a factory with no per-request access. The report is the
 *   measurement that tells us precisely which of them need one.
 */
export const buildContentSecurityPolicy = (
  options: SecurityHeaderOptions = {},
): string => {
  const directives = Object.entries(mergeSources(options.extraSources)).map(
    ([directive, sources]) => `${directive} ${sources.join(' ')}`,
  );
  if (options.reportPath) directives.push(`report-uri ${options.reportPath}`);
  return directives.join('; ');
};

/**
 * The headers every response from an app Worker carries (AGENTS.md §10).
 *
 * `enforceCsp` turns the report-only policy into an enforced one, `reportPath` names the endpoint
 * this origin accepts violation reports on, and `extraSources` lets one app add a directive source
 * the shared policy does not carry.
 *
 * Everything except the CSP is enforced immediately: none of them can change how a page renders, so
 * there is nothing to measure first. `Strict-Transport-Security` is safe because both apps are
 * HTTPS-only custom domains. `frame-ancestors 'none'` in the policy and `X-Frame-Options: DENY`
 * say the same thing to new and old browsers; neither app is ever embedded.
 */
export const securityHeaders = (
  options: SecurityHeaderOptions = {},
): Record<string, string> => {
  const policy = buildContentSecurityPolicy(options);
  return {
    'strict-transport-security': 'max-age=31536000; includeSubDomains',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
    'x-frame-options': 'DENY',
    'permissions-policy':
      'accelerometer=(), camera=(), geolocation=(self), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
    [options.enforceCsp
      ? 'content-security-policy'
      : 'content-security-policy-report-only']: policy,
  };
};

/**
 * Copy `response` with the security headers applied.
 *
 * A 101 WebSocket upgrade is returned untouched: its `webSocket` field does not survive being
 * reconstructed, and headers on it are never read by a browser anyway.
 */
export const withSecurityHeaders = (
  response: Response,
  options: SecurityHeaderOptions = {},
): Response => {
  if (response.status === 101) return response;
  const headers = new Headers(response.headers);
  for (const [name, value] of Object.entries(securityHeaders(options))) {
    headers.set(name, value);
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
};
