const NO_INDEX = 'noindex, nofollow';

export const privateRouteFailures = ({ path, response, body }) => {
  const failures = [];
  const robotsHeader = response.headers.get('x-robots-tag');
  const cacheControl = response.headers.get('cache-control');
  if (response.status < 200 || response.status >= 400)
    failures.push(
      `${path}: utility response has unexpected status ${response.status}`,
    );
  if (robotsHeader !== NO_INDEX)
    failures.push(
      `${path}: expected ${NO_INDEX} response header, got ${robotsHeader ?? 'missing'}`,
    );
  if (cacheControl !== 'private, no-store')
    failures.push(
      `${path}: expected private, no-store cache policy, got ${cacheControl ?? 'missing'}`,
    );
  if (/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/iu.test(body))
    failures.push(`${path}: utility page must not emit a canonical`);
  return failures;
};
