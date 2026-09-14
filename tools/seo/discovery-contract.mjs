const PRODUCTION_ORIGIN = 'https://founders.coffee';
const NO_INDEX = 'noindex, nofollow';
export const SEO_SMOKE_USER_AGENT = 'founders-coffee-seo-smoke/1.0';

const read = async (origin, path) => {
  const response = await fetch(new URL(path, `${origin}/`), {
    headers: { 'user-agent': SEO_SMOKE_USER_AGENT },
    redirect: 'manual',
  });
  return { response, body: await response.text() };
};

export const discoveryFailures = async ({ origin, canonicalOrigin }) => {
  const failures = [];
  const isProduction = canonicalOrigin === PRODUCTION_ORIGIN;
  const llms = await read(origin, '/llms.txt');
  if (llms.response.status !== 200)
    failures.push(`llms.txt: expected 200, got ${llms.response.status}`);
  if (!(llms.response.headers.get('content-type') ?? '').includes('text/plain'))
    failures.push('llms.txt: expected text/plain content type');
  const llmsRobots = llms.response.headers.get('x-robots-tag');
  if (isProduction) {
    if (llmsRobots?.toLowerCase().includes('noindex'))
      failures.push('llms.txt: production response is noindex');
    if (!llms.body.includes(`${PRODUCTION_ORIGIN}/events.json`))
      failures.push('llms.txt: production feed link is missing');
    if (llms.body.includes('staging.founders.coffee'))
      failures.push('llms.txt: production output contains staging origin');
  } else {
    if (llmsRobots !== NO_INDEX)
      failures.push(`llms.txt: expected ${NO_INDEX} response header`);
    if (llms.response.headers.get('cache-control') !== 'no-store')
      failures.push('llms.txt: staging response must be no-store');
    if (llms.body.includes(PRODUCTION_ORIGIN))
      failures.push('llms.txt: staging output contains production origin');
  }

  const feed = await read(origin, '/events.json?limit=1');
  if (feed.response.status !== 200)
    failures.push(`events.json: expected 200, got ${feed.response.status}`);
  if (
    !(feed.response.headers.get('content-type') ?? '').includes(
      'application/json',
    )
  )
    failures.push('events.json: expected application/json content type');
  const feedRobots = feed.response.headers.get('x-robots-tag');
  if (isProduction) {
    if (feedRobots?.toLowerCase().includes('noindex'))
      failures.push('events.json: production response is noindex');
  } else {
    if (feedRobots !== NO_INDEX)
      failures.push(`events.json: expected ${NO_INDEX} response header`);
    if (feed.response.headers.get('cache-control') !== 'no-store')
      failures.push('events.json: staging response must be no-store');
    try {
      const payload = JSON.parse(feed.body);
      if (payload.items?.length !== 0 || payload.nextCursor !== null)
        failures.push('events.json: staging feed must be empty');
    } catch {
      failures.push('events.json: staging response is not valid JSON');
    }
  }
  if (feed.body.includes('staging.founders.coffee'))
    failures.push('events.json: output contains staging origin');
  return failures;
};
