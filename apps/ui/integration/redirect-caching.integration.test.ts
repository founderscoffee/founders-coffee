import { LOCALES } from '@founders-coffee/core/locale';
import { createDb, events, seed, user } from '@founders-coffee/db';
import { cookieName } from '@founders-coffee/i18n';
import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import { COMPANY_PAGES } from '../src/content/company/pages';
import { GEO_COOKIE } from '../src/features/markets/api';
import worker from '../src/server';

const ORIGIN = 'https://founders.coffee';
const FRENCH = `${cookieName}=fr`;
const SHORT_ID = 'redirect_cache';
const EVENT_ID = `evt_${SHORT_ID}`;
const EVENT_SLUG = 'redirect-cache-meetup';

type Hop = {
  readonly path: string;
  readonly cookie?: string;
  readonly location: string;
};

const fetchOnce = async (path: string, cookie?: string): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}${path}`, {
      headers: cookie
        ? { accept: 'text/html', cookie }
        : { accept: 'text/html' },
    }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

const PER_READER: readonly Hop[] = [
  { path: '/', location: '/ar/algeria' },
  { path: '/', cookie: FRENCH, location: '/fr/algeria' },
  ...LOCALES.map((locale) => ({
    path: `/${locale}`,
    location: `/${locale}/algeria`,
  })),
  { path: '/fr', cookie: `${GEO_COOKIE}=egypt`, location: '/fr/egypt' },
  ...Object.keys(COMPANY_PAGES).flatMap((page) => [
    { path: `/${page}`, location: `/ar/${page}` },
    { path: `/${page}`, cookie: FRENCH, location: `/fr/${page}` },
  ]),
  { path: '/algeria', location: '/ar/algeria' },
  { path: '/algeria', cookie: FRENCH, location: '/fr/algeria' },
  {
    path: '/dz/e/some-meetup',
    cookie: FRENCH,
    location: '/fr/algeria/e/some-meetup',
  },
];

const CANONICAL: readonly Hop[] = [
  { path: '/ar/dz', location: '/ar/algeria' },
  { path: `/fr/e/${SHORT_ID}`, location: `/fr/algeria/e/${EVENT_SLUG}` },
];

const label = ({ path, cookie }: Hop): string =>
  cookie ? `${path} with ${cookie}` : path;

/**
 * Follow each hop once, check it lands where it should, and list the ones a shared cache may keep.
 *
 * The cache policy is collected rather than asserted hop by hop, so a regression reports every
 * redirect it left bare instead of stopping at the first.
 */
const shareable = async (hops: readonly Hop[]): Promise<string[]> => {
  const found: string[] = [];
  for (const hop of hops) {
    const response = await fetchOnce(hop.path, hop.cookie);
    const cacheControl = response.headers.get('cache-control');

    expect(response.status, label(hop)).toBe(307);
    expect(response.headers.get('location'), label(hop)).toBe(hop.location);
    if (cacheControl !== 'private, no-store')
      found.push(`${label(hop)} → ${hop.location}: ${cacheControl ?? 'none'}`);
  }
  return found;
};

describe('the redirects the Worker answers', () => {
  beforeAll(async () => {
    const db = createDb(env.DB);
    await seed(db);
    await db
      .insert(user)
      .values({
        id: 'usr_redirect_cache',
        name: 'Redirect Cache Host',
        email: 'redirect-cache@test.coffee',
        role: 'host',
      })
      .onConflictDoNothing()
      .run();
    await db
      .insert(events)
      .values({
        id: EVENT_ID,
        hostId: 'usr_redirect_cache',
        marketCode: 'DZ',
        stateCode: '16',
        cityCode: '556',
        title: 'Redirect cache meetup',
        description: 'A public meetup whose short address redirects.',
        venue: 'Café des Délices',
        startsAt: new Date('2099-03-15T18:00:00Z'),
        language: 'fr',
        slug: EVENT_SLUG,
        status: 'published',
      })
      .onConflictDoNothing()
      .run();
  });

  it('keep those chosen for this reader out of every shared cache', async () => {
    const found = await shareable(PER_READER);

    expect(
      found,
      "each of these chose its destination from the reader's cookie or country, and a cache that kept one would send everyone after them there too. A route's headers() never reach a redirect, so the Worker's floor is the only thing that can say so",
    ).toEqual([]);
  });

  it('keep the rest private too, because none names a policy of its own', async () => {
    const found = await shareable(CANONICAL);

    expect(
      found,
      'these land in the same place whoever asks, but the floor reads the status rather than guessing which redirects depend on the reader',
    ).toEqual([]);
  });

  it('still hand the reader the market chosen for them at /', async () => {
    const response = await fetchOnce('/');

    expect(response.headers.get('set-cookie')).toContain(
      `${GEO_COOKIE}=algeria;`,
    );
  });

  it('leave the page they land on publicly cacheable', async () => {
    const response = await fetchOnce('/ar/about');

    expect(response.status).toBe(200);
    expect(
      response.headers.get('cache-control'),
      'the floor reads the status, so a page a redirect leads to keeps the public policy the root route gives it',
    ).toMatch(/^public,/u);
  });
});
