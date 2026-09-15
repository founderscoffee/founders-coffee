import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';
import {
  createDb,
  createEvent,
  seed,
  user,
  type NewUser,
} from '@founders-coffee/db';
import { geo } from '@founders-coffee/domain';

import { resolveTrendingStates } from './resolver.js';

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
      language: 'fr',
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
      language: 'fr',
      category: 'coffee-meetup',
      status: 'published',
    });

    const trending = await resolveTrendingStates(db, 'DZ');
    expect(trending.variant).toBe('active');
    expect(trending.groups.length).toBeGreaterThan(0);

    const stateGroups = trending.groups.filter((g) => g.state !== null);

    expect(stateGroups.length).toBeLessThanOrEqual(3);
    expect(stateGroups.flatMap((g) => g.cities).every((c) => c.count > 0)).toBe(
      true,
    );
    expect(
      stateGroups
        .flatMap((g) => g.cities)
        .map((c) => c.city.slug)
        .sort(),
    ).toEqual(['algiers', 'oran'].sort());
  });

  it('offers featured cities with no meetups as pioneer entries, never communes', async () => {
    const db = createDb(env.DB);
    await seed(db);
    await db.insert(user).values(host).onConflictDoNothing().run();

    const algiers = geo.findCityBySlug('DZ', 'algiers');
    expect(algiers).toBeDefined();
    if (!algiers) return;

    await createEvent(db, {
      id: 'evt_trend_pioneer',
      slug: 'trend-pioneer-meetup',
      hostId: host.id,
      marketCode: 'DZ',
      stateCode: algiers.stateCode,
      cityCode: algiers.code,
      title: 'Algiers founders coffee',
      description: 'Warm-path event so the market is not cold.',
      venue: 'Café Alger',
      startsAt: new Date('2099-03-01T18:00:00Z'),
      capacity: 12,
      language: 'en',
      category: 'coffee-meetup',
      status: 'published',
    });

    const trending = await resolveTrendingStates(db, 'DZ');
    const pioneer = trending.groups.find((g) => g.state === null);
    expect(pioneer).toBeDefined();
    if (!pioneer) return;

    expect(pioneer.cities.length).toBeGreaterThan(0);
    expect(pioneer.cities.every((c) => c.count === 0)).toBe(true);

    const featured = new Set(
      geo.getFeaturedCities('DZ').map((city) => city.code),
    );
    expect(pioneer.cities.every((c) => featured.has(c.city.code))).toBe(true);
    expect(pioneer.cities.some((c) => c.city.code === algiers.code)).toBe(
      false,
    );
  });
});
