const PRODUCTION_ORIGIN = 'https://founders.coffee';
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
  if (links && /https?:\/\/(?!founders\.coffee)/iu.test(links))
    failures.push(`${path}: Early Hint Link header points to another origin`);
  const missing = WORKER_HEADERS.filter((name) => !hasHeader(response, name));
  if (missing.length > 0)
    failures.push(
      `${path}: no ${missing.join(', ')}, so the Worker did not answer it`,
    );
  return failures;
};
