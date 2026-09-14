import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { discoveryFailures } from './discovery-contract.mjs';
import { inspectGeoDocument } from './geo-contract.mjs';
import { fetchSmoke } from './http.mjs';
import { privateRouteFailures } from './private-contract.mjs';

const DEFAULT_ORIGIN = 'https://staging.founders.coffee';
const LOCALES = ['ar', 'fr', 'en'];
const COMPANY_PAGES = ['about', 'contact', 'cookies', 'privacy', 'terms'];
const PRIVATE_PATHS = [
  '/account',
  '/profile',
  '/preferences',
  '/activity',
  '/algeria/host/create',
];
const HTML_CONTENT_TYPE = 'text/html';
const NO_INDEX = 'noindex, nofollow';
const MAX_DYNAMIC_ROUTES = 25;
const SITEMAP_SMOKE_QUERY = '?seo_smoke=1';

const argument = (name, fallback) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? fallback : (process.argv[index + 1] ?? fallback);
};

const origin = argument(
  '--origin',
  process.env.SEO_ORIGIN ?? DEFAULT_ORIGIN,
).replace(/\/$/u, '');
const canonicalOrigin = argument('--canonical-origin', origin).replace(
  /\/$/u,
  '',
);
const reportPath = argument('--output', 'seo-route-report.json');
const sitemapPath = argument('--sitemap-output', 'sitemap.xml');
const requireDynamic = process.argv.includes('--require-dynamic');
const maxDynamicRoutes = Number(
  argument('--max-dynamic', String(MAX_DYNAMIC_ROUTES)),
);

const absoluteUrl = (path) => new URL(path, `${origin}/`).toString();

const readAttribute = (tag, name) => {
  const match = tag.match(new RegExp(`${name}=["']([^"']+)["']`, 'iu'));
  return match?.[1] ?? null;
};

const linksFromHtml = (html) => {
  const links = new Set();
  for (const match of html.matchAll(/href=["']([^"']+)["']/giu)) {
    const href = match[1];
    if (!href || !href.startsWith('/')) continue;
    const url = new URL(href, `${origin}/`);
    if (url.origin === origin && LOCALES.includes(url.pathname.split('/')[1]))
      links.add(url.pathname);
  }
  return [...links];
};

const classifyPath = (path) => {
  const segments = path.split('/').filter(Boolean);
  if (segments.length < 2 || !LOCALES.includes(segments[0])) return null;
  if (COMPANY_PAGES.includes(segments[1])) return 'company';
  if (segments[1] === 'host' && segments[2] === 'create') return 'utility';
  if (segments.length === 2) return 'market';
  if (segments[2] === 'e' && segments.length === 4) return 'event';
  if (segments.length === 3) return 'city';
  if (segments.length === 4 && segments[3] === 'host') return 'utility';
  return null;
};

const routeEntry = (path, type, response, body, failures) => {
  const contentType = response.headers.get('content-type') ?? '';
  const robots = response.headers.get('x-robots-tag');
  const cacheControl = response.headers.get('cache-control');
  const canonicalTags = [
    ...body.matchAll(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*>/giu),
  ];
  const canonical = canonicalTags[0]
    ? readAttribute(canonicalTags[0][0], 'href')
    : null;
  const expectedCanonical = new URL(path, `${canonicalOrigin}/`).toString();
  if (response.status !== 200)
    failures.push(`${path}: expected 200, got ${response.status}`);
  if (!contentType.toLowerCase().includes(HTML_CONTENT_TYPE))
    failures.push(
      `${path}: expected HTML content type, got ${contentType || 'missing'}`,
    );
  if (canonicalTags.length !== 1)
    failures.push(
      `${path}: expected one canonical, got ${canonicalTags.length}`,
    );
  if (canonical !== expectedCanonical)
    failures.push(
      `${path}: canonical ${canonical ?? 'missing'} != ${expectedCanonical}`,
    );
  for (const failure of inspectGeoDocument({
    path,
    type,
    body,
    canonical,
  }))
    failures.push(`${path}: GEO ${failure}`);
  if (canonicalOrigin === 'https://founders.coffee') {
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
  return {
    path,
    type,
    status: response.status,
    contentType,
    canonical,
    robots,
    cacheControl,
    hreflangCount: (body.match(/rel=["']alternate["']/giu) ?? []).length,
  };
};

const fetchResponse = async (path, followRedirects = true) => {
  let current = absoluteUrl(path);
  const redirects = [];
  for (let hop = 0; hop <= 3; hop += 1) {
    const response = await fetchSmoke(current, {
      headers: { accept: 'text/html' },
      redirect: 'manual',
    });
    const location = response.headers.get('location');
    if (
      !followRedirects ||
      !location ||
      response.status < 300 ||
      response.status >= 400
    )
      return { response, body: await response.text(), redirects };
    redirects.push({ status: response.status, location });
    current = new URL(location, current).toString();
  }
  throw new Error(`${path}: redirect chain exceeded three hops`);
};

const fetchStatic = async (path) => {
  const { response, body } = await fetchResponse(path);
  return { response, body };
};

const run = async () => {
  const failures = [];
  const routes = [];
  const robotsResponse = await fetchSmoke(
    new URL('/robots.txt', `${origin}/`),
    {
      redirect: 'manual',
    },
  );
  const robots = await robotsResponse.text();
  if (robotsResponse.status !== 200)
    failures.push(`robots.txt: expected 200, got ${robotsResponse.status}`);
  if (canonicalOrigin === 'https://founders.coffee') {
    if (!robots.includes('Sitemap: https://founders.coffee/sitemap.xml'))
      failures.push('robots.txt: production sitemap reference is missing');
  } else if (!robots.includes('Disallow: /') || robots.includes('Sitemap:')) {
    failures.push(
      'robots.txt: staging must disallow crawling without a sitemap reference',
    );
  }

  const sitemapResponse = await fetchSmoke(
    new URL(`/sitemap.xml${SITEMAP_SMOKE_QUERY}`, `${origin}/`),
    {
      redirect: 'manual',
    },
  );
  const sitemap = await sitemapResponse.text();
  if (sitemapResponse.status !== 200)
    failures.push(`sitemap.xml: expected 200, got ${sitemapResponse.status}`);
  if (
    !(sitemapResponse.headers.get('content-type') ?? '').includes(
      'application/xml',
    )
  )
    failures.push('sitemap.xml: expected application/xml content type');
  if (!sitemap.includes('<urlset'))
    failures.push('sitemap.xml: urlset is missing');
  if (canonicalOrigin !== 'https://founders.coffee' && /<url>/u.test(sitemap))
    failures.push('sitemap.xml: staging sitemap must be empty');
  const sitemapUrls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/giu)].map(
    (match) => match[1],
  );
  failures.push(...(await discoveryFailures({ origin, canonicalOrigin })));

  const paths = new Set([
    ...LOCALES.flatMap((locale) => [
      ...COMPANY_PAGES.map((page) => `/${locale}/${page}`),
      `/${locale}/algeria`,
    ]),
  ]);
  let sitemapDynamicCount = 0;
  for (const sitemapUrl of sitemapUrls) {
    try {
      const parsed = new URL(sitemapUrl);
      const type = classifyPath(parsed.pathname);
      if (parsed.origin !== origin || !type) continue;
      if (
        type === 'market' ||
        type === 'company' ||
        (sitemapDynamicCount < maxDynamicRoutes &&
          (type === 'city' || type === 'event'))
      ) {
        paths.add(parsed.pathname);
        if (type === 'city' || type === 'event') sitemapDynamicCount += 1;
      }
    } catch {
      failures.push(`sitemap.xml: invalid URL ${sitemapUrl}`);
    }
  }
  const discovery = [];
  for (const locale of LOCALES) {
    const path = `/${locale}/algeria`;
    const { response, body } = await fetchStatic(path);
    routes.push(routeEntry(path, 'market', response, body, failures));
    discovery.push(...linksFromHtml(body));
  }
  let dynamicCount = 0;
  for (const path of discovery) {
    const type = classifyPath(path);
    if (
      (type === 'market' || type === 'city' || type === 'event') &&
      (type === 'market' || dynamicCount < maxDynamicRoutes)
    ) {
      paths.add(path);
      if (type !== 'market') dynamicCount += 1;
    }
  }
  for (const path of paths) {
    if (routes.some((route) => route.path === path)) continue;
    const type = classifyPath(path) ?? 'public';
    const { response, body } = await fetchStatic(path);
    routes.push(routeEntry(path, type, response, body, failures));
  }
  for (const path of PRIVATE_PATHS) {
    const { response, body } = await fetchResponse(path, false);
    failures.push(...privateRouteFailures({ path, response, body }));
  }
  const coverage = Object.fromEntries(
    ['company', 'market', 'city', 'event'].map((type) => [
      type,
      routes.filter((route) => route.type === type).length,
    ]),
  );
  if (requireDynamic && (coverage.city === 0 || coverage.event === 0))
    failures.push(
      `dynamic route coverage missing city=${coverage.city}, event=${coverage.event}`,
    );
  const report = {
    generatedAt: new Date().toISOString(),
    origin,
    indexableExpected: canonicalOrigin === 'https://founders.coffee',
    canonicalOrigin,
    robots: { status: robotsResponse.status, body: robots },
    sitemap: { status: sitemapResponse.status, urlCount: sitemapUrls.length },
    coverage: { locales: LOCALES, classes: coverage },
    routes: routes.sort((a, b) => a.path.localeCompare(b.path)),
    discoveredSitemapUrls: sitemapUrls,
    failures,
  };
  await mkdir(dirname(reportPath), { recursive: true });
  await mkdir(dirname(sitemapPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  await writeFile(sitemapPath, sitemap, 'utf8');
  process.stdout.write(
    `${JSON.stringify({ origin, routes: routes.length, failures: failures.length, reportPath, sitemapPath })}\n`,
  );
  if (failures.length > 0) process.exitCode = 1;
};

run().catch((error) => {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`,
  );
  process.exitCode = 1;
});
