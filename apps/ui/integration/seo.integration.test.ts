import { createDb, events, seed, user } from '@founders-coffee/db';
import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import worker from '../src/server';

const ORIGIN = 'https://staging.founders.coffee';

const fetchDocument = async (pathname: string): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}${pathname}`, {
      headers: { accept: 'text/html' },
    }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

describe('public Worker SEO contract', () => {
  beforeAll(async () => {
    const db = createDb(env.DB);
    await seed(db);
    await db
      .insert(user)
      .values({
        id: 'usr_geo_feed',
        name: 'GEO Feed Host',
        email: 'geo-feed@test.coffee',
        role: 'host',
      })
      .onConflictDoNothing()
      .run();
    await db
      .insert(events)
      .values({
        id: 'evt_geo_feed',
        hostId: 'usr_geo_feed',
        marketCode: 'DZ',
        stateCode: '16',
        cityCode: '556',
        title: 'GEO feed meetup',
        description: 'A public meetup used by the GEO feed integration test.',
        venue: 'Café des Délices',
        startsAt: new Date('2099-01-15T18:00:00Z'),
        language: 'fr',
        slug: 'geo-feed-meetup',
        status: 'published',
      })
      .onConflictDoNothing()
      .run();
  });

  it('serves staging robots and an empty staging sitemap', async () => {
    const robots = await worker.fetch(
      new Request(`${ORIGIN}/robots.txt`),
      env,
      createExecutionContext(),
    );
    const robotsBody = await robots.text();
    expect(robots.status).toBe(200);
    expect(robots.headers.get('content-type')).toContain('text/plain');
    expect(robotsBody).toContain('Disallow: /');
    expect(robotsBody).not.toContain('Sitemap:');

    const sitemap = await worker.fetch(
      new Request(`${ORIGIN}/sitemap.xml`),
      env,
      createExecutionContext(),
    );
    const sitemapBody = await sitemap.text();
    expect(sitemap.status).toBe(200);
    expect(sitemap.headers.get('content-type')).toContain('application/xml');
    expect(sitemapBody).toContain('<urlset');
    expect(sitemapBody).not.toContain('<url>');
  });

  it('sends a cursor that names nothing back to the clean URL', async () => {
    const cases = [
      [
        '/en/algeria?afterStartsAt=1700000000000&afterId=no-such-event',
        '/en/algeria',
      ],
      ['/en/algeria?afterStartsAt=9999999999999&afterId=nope', '/en/algeria'],
      [
        '/en/algeria/algiers?afterStartsAt=1700000000000&afterId=nope',
        '/en/algeria/algiers',
      ],
    ] as const;

    for (const [path, destination] of cases) {
      const response = await fetchDocument(path);

      expect(
        response.status,
        `${path} answered instead of redirecting: a cursor naming no row is not page two, it is a second address for page one, and a crawler can mint unlimited ones`,
      ).toBe(307);
      expect(
        new URL(response.headers.get('location') ?? '', ORIGIN).pathname.concat(
          new URL(response.headers.get('location') ?? '', ORIGIN).search,
        ),
        `${path} redirected somewhere other than its own clean URL`,
      ).toBe(destination);
    }
  });

  it('serves a staging-safe llms guide and a production discovery guide', async () => {
    const staging = await worker.fetch(
      new Request(`${ORIGIN}/llms.txt`),
      env,
      createExecutionContext(),
    );
    const stagingBody = await staging.text();

    expect(staging.status).toBe(200);
    expect(staging.headers.get('content-type')).toContain('text/plain');
    expect(staging.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(staging.headers.get('cache-control')).toBe('no-store');
    expect(stagingBody).toContain(
      'This staging environment is not for public discovery.',
    );
    expect(
      stagingBody.split('\n').filter((line) => line.startsWith('- ')),
      'staging carries one link, to itself: enough for the audit (#33), and not a production URL',
    ).toEqual([`- [Founders Coffee](${ORIGIN})`]);
    expect(
      stagingBody,
      'tools/seo/discovery-contract.mjs fails the deploy on this, and it only runs after the Worker is already live',
    ).not.toContain('https://founders.coffee');
    expect(stagingBody).not.toContain('/sitemap.xml');
    expect(stagingBody).not.toContain('/events.json');
    expect(stagingBody).not.toContain('/e/');

    const production = await worker.fetch(
      new Request('https://founders.coffee/llms.txt'),
      env,
      createExecutionContext(),
    );
    const productionBody = await production.text();

    expect(production.status).toBe(200);
    expect(production.headers.get('content-type')).toContain('text/plain');
    expect(production.headers.get('x-robots-tag')).toBeNull();
    expect(production.headers.get('cache-control')).toContain('s-maxage=3600');
    expect(productionBody).toContain('# Founders Coffee');
    expect(productionBody).toContain('https://founders.coffee/sitemap.xml');
    expect(productionBody).toContain('https://founders.coffee/robots.txt');
    expect(productionBody).not.toContain('staging.founders.coffee');
  });

  it('serves a bounded public event feed and keeps staging empty', async () => {
    const staging = await worker.fetch(
      new Request(`${ORIGIN}/events.json?market=algeria`),
      env,
      createExecutionContext(),
    );
    const stagingBody = (await staging.json()) as {
      readonly items: readonly unknown[];
      readonly nextCursor: string | null;
    };
    expect(staging.status).toBe(200);
    expect(staging.headers.get('content-type')).toContain('application/json');
    expect(staging.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(stagingBody).toEqual({ items: [], nextCursor: null });

    const production = await worker.fetch(
      new Request('https://founders.coffee/events.json?market=algeria&limit=1'),
      env,
      createExecutionContext(),
    );
    const productionBody = (await production.json()) as {
      readonly items: readonly Record<string, unknown>[];
      readonly nextCursor: string | null;
    };
    expect(production.status).toBe(200);
    expect(production.headers.get('x-robots-tag')).toBeNull();
    expect(production.headers.get('cache-control')).toContain('s-maxage=300');
    expect(productionBody.items).toHaveLength(1);
    expect(productionBody.items[0]).toMatchObject({
      slug: 'geo-feed-meetup',
      market: 'algeria',
      city: 'algiers',
      language: 'fr',
      url: 'https://founders.coffee/fr/algeria/e/geo-feed-meetup',
      organizer: { name: 'GEO Feed Host' },
    });
    expect(productionBody.items[0]).not.toHaveProperty('id');
    expect(productionBody.items[0]).not.toHaveProperty('hostId');
    expect(productionBody.items[0]).not.toHaveProperty('rsvps');

    const invalid = await worker.fetch(
      new Request('https://founders.coffee/events.json?limit=0'),
      env,
      createExecutionContext(),
    );
    expect(invalid.status).toBe(400);
    expect(invalid.headers.get('content-type')).toContain('application/json');
    expect(invalid.headers.get('cache-control')).toBe('no-store');
    await expect(invalid.json()).resolves.toEqual({
      error: 'invalid_request',
    });

    const invalidCursor = await worker.fetch(
      new Request('https://founders.coffee/events.json?cursor=not-a-cursor'),
      env,
      createExecutionContext(),
    );
    expect(invalidCursor.status).toBe(400);
    expect(invalidCursor.headers.get('cache-control')).toBe('no-store');
    await expect(invalidCursor.json()).resolves.toEqual({
      error: 'invalid_request',
    });
  });

  it('renders a public locale page with staging-safe metadata and hints', async () => {
    const response = await fetchDocument('/ar/algeria');
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(response.headers.get('cache-control')).toContain('s-maxage=60');
    expect(body).toContain('<html lang="ar"');
    expect(body).toContain('https://staging.founders.coffee/ar/algeria');
    expect(body).toContain('<h1');
    const linkHeader = response.headers.get('link');
    if (linkHeader) {
      expect(linkHeader).toMatch(/<\/assets\//u);
      expect(linkHeader).not.toMatch(
        /https?:\/\/(?!staging\.founders\.coffee)/u,
      );
    }
  });

  it('keeps utility pages private and noindex', async () => {
    const response = await fetchDocument('/login');

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('/login');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(response.headers.get('link')).toBeNull();
  });

  it('preserves one-hop redirects without Early Hints', async () => {
    const response = await fetchDocument('/about');

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('/ar/about');
    expect(response.headers.get('link')).toBeNull();
  });
});
