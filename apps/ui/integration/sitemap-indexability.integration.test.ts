import { createDb, events, seed, user } from '@founders-coffee/db';
import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import worker from '../src/server';

const fetchDocument = async (url: string): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(url, { headers: { accept: 'text/html' } }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

/**
 * The sitemap and the pages it points at have to agree about indexing.
 *
 * They did not. `cityPageHead` answers `noindex,follow` for a city with no upcoming gathering,
 * while the sitemap was built by walking the geo catalogue — every city of every visible market,
 * three locales apiece — so it advertised 17,484 city URLs of which all but a handful refused
 * indexing on arrival (#82). Search Console reported it as four pages and climbing, because that
 * was simply as far as the crawler had got.
 *
 * Two projects decided this separately and each was locally correct, which is why the check lives
 * out here where both are running: it reads the real sitemap out of the real Worker and the real
 * meta tag off a real page.
 */
describe('what the sitemap is willing to have indexed', () => {
  beforeAll(async () => {
    const db = createDb(env.DB);
    await seed(db);
    await db
      .insert(user)
      .values({
        id: 'usr_sitemap_host',
        name: 'Sitemap Host',
        email: 'sitemap-host@test.coffee',
        role: 'host',
      })
      .onConflictDoNothing()
      .run();
    await db
      .insert(events)
      .values({
        id: 'evt_sitemap_algiers',
        hostId: 'usr_sitemap_host',
        marketCode: 'DZ',
        stateCode: '16',
        cityCode: '556',
        title: 'Sitemap meetup',
        description:
          'A published upcoming meetup, so Algiers is worth listing.',
        venue: 'Caf\u00e9 des D\u00e9lices',
        startsAt: new Date('2099-01-15T18:00:00Z'),
        language: 'fr',
        slug: 'sitemap-meetup',
        status: 'published',
      })
      .onConflictDoNothing()
      .run();
    await db
      .insert(events)
      .values({
        id: 'evt_sitemap_reghaia',
        hostId: 'usr_sitemap_host',
        marketCode: 'DZ',
        stateCode: '16',
        cityCode: '602',
        title: 'Sitemap meetup that already happened',
        description:
          'A published gathering that is over, so Reghaia is empty again.',
        venue: 'Café des Délices',
        startsAt: new Date('2020-01-15T18:00:00Z'),
        endsAt: new Date('2020-01-15T20:00:00Z'),
        language: 'fr',
        slug: 'sitemap-meetup-past',
        status: 'published',
      })
      .onConflictDoNothing()
      .run();
  });

  const cityPathsInSitemap = async (): Promise<string[]> => {
    const sitemap = await worker.fetch(
      new Request('https://founders.coffee/sitemap.xml'),
      env,
      createExecutionContext(),
    );
    const xml = await sitemap.text();
    return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((match) => new URL(match[1]).pathname)
      .filter((path) => /^\/(ar|en|fr)\/[^/]+\/[^/]+$/.test(path));
  };

  const robotsOf = async (path: string): Promise<string> => {
    const response = await fetchDocument(`https://founders.coffee${path}`);
    const html = await response.text();
    return (
      html.match(/<meta[^>]+name="robots"[^>]+content="([^"]+)"/)?.[1] ?? ''
    );
  };

  it('lists a city that has an upcoming gathering', async () => {
    expect(await robotsOf('/ar/algeria/algiers')).toContain('index,follow');
    expect(await cityPathsInSitemap()).toContain('/ar/algeria/algiers');
  });

  it('leaves out a city whose page would refuse indexing', async () => {
    expect(
      await robotsOf('/fr/algeria/reghaia'),
      'this suite only means something while an eventless city is still noindexed',
    ).toContain('noindex');

    expect(
      await cityPathsInSitemap(),
      'Reghaia holds a published gathering that is over. Its event page stays indexable and stays in the sitemap; its city page went back to noindex, so the city must not. Building the city list from the event rows instead of the upcoming ones passes every other case here and fails this one',
    ).not.toContain('/fr/algeria/reghaia');
  });

  it('stays the size of the events, not the size of the atlas', async () => {
    const cityPaths = await cityPathsInSitemap();

    expect(
      cityPaths.length,
      'one seeded city times three locales; a catalogue-sized number here means the geo walk is back',
    ).toBe(3);
    expect(new Set(cityPaths).size).toBe(cityPaths.length);
  });
});
