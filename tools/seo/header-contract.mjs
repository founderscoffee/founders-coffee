const PRODUCTION_ORIGIN = 'https://founders.coffee';
const MEETUP_MAP_ORIGIN = 'https://api.mapbox.com';
const NO_INDEX = 'noindex, nofollow';
const CSP = 'content-security-policy';
const WORKER_HEADERS = [
  CSP,
  'strict-transport-security',
  'x-content-type-options',
  'referrer-policy',
  'x-frame-options',
  'permissions-policy',
];

const hasHeader = (response, name) =>
  response.headers.has(name) ||
  (name === CSP && response.headers.has(`${CSP}-report-only`));

/**
 * Whether one entry of a Link header names an origin other than the site's own.
 *
 * Cloudflare sends a page's Link header to its later readers as an Early Hint, so every hint has to
 * hold for all of them. The one other origin allowed is the connection a meetup page opens to
 * Mapbox for its map's picture: a preconnect naming the origin and nothing else, the same single
 * exception `isCacheSafeEarlyHint` makes in apps/ui.
 */
const pointsElsewhere = (entry) => {
  const target = /^\s*<([^>]*)>/u.exec(entry)?.[1] ?? '';
  if (
    !/^https?:\/\//iu.test(target) ||
    /^https?:\/\/founders\.coffee(?:[/:?#]|$)/iu.test(target)
  )
    return false;
  const isPreconnect = /;\s*rel="?preconnect"?\s*(?:;|$)/iu.test(entry);
  return !(isPreconnect && target === MEETUP_MAP_ORIGIN);
};

/**
 * What the response headers of a public document must say, whatever its route.
 *
 * The security headers are how a document shows the Worker answered it. Workers Assets serves a
 * file it holds without running the Worker, so a document built ahead of time goes out with none
 * of them, and with whatever the build knew in place of what the request should have read (#104).
 * A report-only policy counts: it is still the Worker's.
 */
export const documentHeaderFailures = ({ path, response, canonicalOrigin }) => {
  const failures = [];
  const robots = response.headers.get('x-robots-tag');
  if (canonicalOrigin === PRODUCTION_ORIGIN) {
    if (robots?.toLowerCase().includes('noindex'))
      failures.push(`${path}: production response is noindex`);
  } else if (robots !== NO_INDEX) {
    failures.push(
      `${path}: expected ${NO_INDEX} response header, got ${robots ?? 'missing'}`,
    );
  }
  const links = response.headers.get('link');
  if (links?.split(/,(?=\s*<)/u).some(pointsElsewhere))
    failures.push(`${path}: Early Hint Link header points to another origin`);
  const missing = WORKER_HEADERS.filter((name) => !hasHeader(response, name));
  if (missing.length > 0)
    failures.push(
      `${path}: no ${missing.join(', ')}, so the Worker did not answer it`,
    );
  return failures;
};
