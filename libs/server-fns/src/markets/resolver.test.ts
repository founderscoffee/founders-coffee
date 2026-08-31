import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import {
  createDb,
  createEvent,
  markets as marketsTable,
  seed,
  user,
  type Db,
  type NewUser,
} from '@founders-coffee/db';
import { geo } from '@founders-coffee/domain';

import {
  listVisibleMarkets,
  resolveCityLanding,
  resolveMarket,
  resolveMarketLanding,
  resolveTrendingStates,
} from './resolver.js';

/**
 * Seed a dark market to verify it is hidden from public resolution. Uses `AE` (a target country
 * that is NOT in the active seed) so `onConflictDoNothing` does not silently no-op against a seeded
 * active row — the dark insert must actually take effect.
 */
const seedDarkMarket = async (db: Db): Promise<void> => {
  await db
    .insert(marketsTable)
    .values({
      code: 'AE',
      name: 'United Arab Emirates',
      slug: 'united-arab-emirates',
      defaultLocale: 'ar',
      defaultCurrency: 'AED',
      timezone: 'Asia/Dubai',
      direction: 'rtl',
      state: 'dark',
      featureFlags: {
        events: false,
        hackathons: false,
        payments: false,
        recruiting: false,
      },
    })
    .onConflictDoNothing()
    .run();
};

describe('markets resolver (real D1)', () => {
  it('resolves a visible market by code or slug', async () => {
    const db = createDb(env.DB);
    await seed(db);

    const byCode = await resolveMarket(db, { code: 'DZ' });
    const bySlug = await resolveMarket(db, { slug: 'egypt' });

    expect(byCode.ok).toBe(true);
    if (byCode.ok) expect(byCode.data.code).toBe('DZ');
    expect(bySlug.ok).toBe(true);
    if (bySlug.ok) expect(bySlug.data.code).toBe('EG');
  });

  it('hides dark markets (no existence leak) and unknown codes', async () => {
    const db = createDb(env.DB);
    await seed(db);
    await seedDarkMarket(db);

    const dark = await resolveMarket(db, { code: 'AE' });
    expect(dark.ok).toBe(false);
    if (!dark.ok) expect(dark.error.code).toBe('market_not_found');

    const unknown = await resolveMarket(db, { code: 'ZZ' });
    expect(unknown.ok).toBe(false);
  });

  it('lists only visible markets (dark excluded)', async () => {
    const db = createDb(env.DB);
    await seed(db);
    await seedDarkMarket(db);

    const visible = await listVisibleMarkets(db);

    expect(visible.every((m) => m.state !== 'dark')).toBe(true);
    expect(visible.find((m) => m.code === 'AE')).toBeUndefined();
  });
});

describe('resolveMarketLanding (slug-or-code key)', () => {
  it('resolves by slug or by code alias, returning featured cities from geo data', async () => {
    const db = createDb(env.DB);
    await seed(db);

    const bySlug = await resolveMarketLanding(db, 'egypt');
    const byCode = await resolveMarketLanding(db, 'eg');

    expect(bySlug.ok).toBe(true);
    if (bySlug.ok) {
      expect(bySlug.data.market.code).toBe('EG');
      expect(Array.isArray(bySlug.data.cities)).toBe(true);
      expect(Array.isArray(bySlug.data.events)).toBe(true);
      expect(typeof bySlug.data.cityEventCounts).toBe('object');
      expect(bySlug.data.trending.variant).toBe('major');
      expect(bySlug.data.trending.groups[0]?.state).toBeNull();
    }
    expect(byCode.ok).toBe(true);
    if (byCode.ok) expect(byCode.data.market.code).toBe('EG');
  });

  it('hides dark markets (no existence leak)', async () => {
    const db = createDb(env.DB);
    await seed(db);
    await seedDarkMarket(db);

    const bySlug = await resolveMarketLanding(db, 'united-arab-emirates');
    const byCode = await resolveMarketLanding(db, 'ae');

    expect(bySlug.ok).toBe(false);
    expect(byCode.ok).toBe(false);
  });
});

describe('resolveCityLanding (market-scoped, validated via geo TS data)', () => {
  it('resolves a city within its market', async () => {
    const db = createDb(env.DB);
    await seed(db);

    const result = await resolveCityLanding(db, {
      marketKey: 'dz',
      citySlug: 'adrar',
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.market.code).toBe('DZ');
      expect(result.data.city.slug).toBe('adrar');
      expect(Array.isArray(result.data.events)).toBe(true);
    }
  });

  it('rejects a city from a different market (no cross-market leak)', async () => {
    const db = createDb(env.DB);
    await seed(db);

    const result = await resolveCityLanding(db, {
      marketKey: 'dz',
      citySlug: 'riyadh',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('city_not_found');
  });

  it('rejects an unknown market', async () => {
    const db = createDb(env.DB);
    await seed(db);

    const result = await resolveCityLanding(db, {
      marketKey: 'zz',
      citySlug: 'anywhere',
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('market_not_found');
  });
});

describe('resolveTrendingStates (cold vs warm)', () => {
  const host: NewUser = {
    id: 'usr_trend_host',
    name: 'Trend Host',
    email: 'trend-host@test.coffee',
    emailVerified: false,
    role: 'host',
  };

  it('cold markets return major featured cities (no empty-commune padding) for DZ/EG/SA', async () => {
    const db = createDb(env.DB);
    await seed(db);

    for (const code of ['DZ', 'EG', 'SA'] as const) {
      const trending = await resolveTrendingStates(db, code);
      expect(trending.variant).toBe('major');
      expect(trending.groups).toHaveLength(1);
      expect(trending.groups[0]?.state).toBeNull();

      const cities = trending.groups[0]?.cities ?? [];
      expect(cities.length).toBeGreaterThan(0);
      expect(cities.length).toBeLessThanOrEqual(18);
      expect(cities.every((c) => c.count === 0)).toBe(true);
      expect(cities.every((c) => c.city.featured)).toBe(true);

      /** Must not pad Adrar/Chlef-style empty communes as "popular". */
      const slugs = cities.map((c) => c.city.slug);
      if (code === 'DZ') {
        expect(slugs[0]).toBe('algiers');
        expect(slugs).toContain('oran');
        expect(slugs).not.toContain('akabli');
      }
      if (code === 'EG') {
        expect(slugs[0]).toBe('cairo');
        expect(slugs).toContain('alexandria');
      }
      if (code === 'SA') {
        expect(slugs[0]).toBe('riyadh');
        expect(slugs).toContain('makkah');
      }

      const featuredCount = geo.getFeaturedCities(code).length;
      expect(cities.length).toBe(Math.min(18, featuredCount));
    }
  });

  it('warm markets only list cities with upcoming events (no zero padding)', async () => {
    const db = createDb(env.DB);
    await seed(db);
    await db.insert(user).values(host).onConflictDoNothing().run();

    const algiers = geo.findCityBySlug('DZ', 'algiers');
    const oran = geo.findCityBySlug('DZ', 'oran');
    expect(algiers).toBeDefined();
    expect(oran).toBeDefined();
    if (!algiers || !oran) return;

    await createEvent(db, {
      id: 'evt_trend_alg',
      slug: 'trend-algiers-meetup',
      hostId: host.id,
      marketCode: 'DZ',
      stateCode: algiers.stateCode,
      cityCode: algiers.code,
      title: 'Algiers founders coffee',
      description: 'Warm-path trending test event in Algiers.',
      venue: 'Café Test',
      startsAt: new Date('2099-03-01T18:00:00Z'),
      capacity: 20,
      language: 'ar_fr',
      category: 'coffee-meetup',
      status: 'published',
    });
    await createEvent(db, {
      id: 'evt_trend_oran',
      slug: 'trend-oran-meetup',
      hostId: host.id,
      marketCode: 'DZ',
      stateCode: oran.stateCode,
      cityCode: oran.code,
      title: 'Oran founders coffee',
      description: 'Warm-path trending test event in Oran.',
      venue: 'Café Oran',
      startsAt: new Date('2099-03-02T18:00:00Z'),
      capacity: 20,
      language: 'ar_fr',
      category: 'coffee-meetup',
      status: 'published',
    });

    const trending = await resolveTrendingStates(db, 'DZ');
    expect(trending.variant).toBe('active');
    expect(trending.groups.length).toBeGreaterThan(0);
    expect(trending.groups.length).toBeLessThanOrEqual(3);

    const allCities = trending.groups.flatMap((g) => g.cities);
    expect(allCities.every((c) => c.count > 0)).toBe(true);
    expect(allCities.map((c) => c.city.slug).sort()).toEqual(
      ['algiers', 'oran'].sort(),
    );
    expect(trending.groups.every((g) => g.state !== null)).toBe(true);
  });
});
