import { env } from 'cloudflare:workers';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  countUpcomingByCity,
  createDb,
  createEvent,
  events,
  seed,
  user,
  type Db,
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

  beforeEach(async () => {
    await createDb(env.DB).delete(events).run();
  });

  const dzCity = (slug: string): geo.GeoCity => {
    const city = geo.findCityBySlug('DZ', slug);
    if (!city) throw new Error(`No DZ city with the slug ${slug}`);
    return city;
  };

  const seedMeetups = async (
    db: Db,
    meetups: readonly (readonly [geo.GeoCity, number])[],
  ): Promise<void> => {
    await db.insert(user).values(host).onConflictDoNothing().run();
    for (const [city, count] of meetups)
      for (let i = 0; i < count; i += 1)
        await createEvent(db, {
          id: `evt_trend_${city.code}_${i}`,
          slug: `trend-${city.slug}-${i}`,
          hostId: host.id,
          marketCode: 'DZ',
          stateCode: city.stateCode,
          cityCode: city.code,
          title: `${city.name} founders coffee`,
          description: 'A meetup that puts its city on the landing grid.',
          venue: 'Café Test',
          startsAt: new Date('2099-03-01T18:00:00Z'),
          language: 'fr',
          status: 'published',
        });
  };

  it('cold markets return 11 ordered landing cities for DZ/EG/SA', async () => {
    const db = createDb(env.DB);
    await seed(db);

    for (const code of ['DZ', 'EG', 'SA'] as const) {
      const trending = await resolveTrendingStates(db, code);
      expect(trending.variant).toBe('major');
      expect(trending.groups).toHaveLength(1);
      expect(trending.groups[0]?.state).toBeNull();

      const cities = trending.groups[0]?.cities ?? [];
      expect(cities).toHaveLength(11);
      expect(cities.every((c) => c.count === 0)).toBe(true);
      expect(
        cities.every((c) => c.hosts.length === 0 && c.hostCount === 0),
        'a city with nothing on has nobody hosting there',
      ).toBe(true);
      const featuredCount = geo.getFeaturedCities(code).length;
      expect(cities.filter((c) => c.city.featured)).toHaveLength(
        Math.min(11, featuredCount),
      );

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
    }
  });

  it('warm markets lead with cities that have upcoming events', async () => {
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

    expect(stateGroups.flatMap((g) => g.cities).every((c) => c.count > 0)).toBe(
      true,
    );
    expect(
      stateGroups
        .flatMap((g) => g.cities)
        .map((c) => c.city.slug)
        .sort(),
    ).toEqual(['algiers', 'oran'].sort());
    expect(trending.groups.flatMap((group) => group.cities)).toHaveLength(11);

    const cards = trending.groups.flatMap((group) => group.cities);
    for (const slug of ['algiers', 'oran'])
      expect(
        cards.find((card) => card.city.slug === slug),
        `the ${slug} card shows who hosts its meetups`,
      ).toMatchObject({
        hosts: [{ name: host.name, photoAssetId: null }],
        hostCount: 1,
      });
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
    expect(
      pioneer.cities.every((c) => c.hosts.length === 0 && c.hostCount === 0),
    ).toBe(true);

    const featured = new Set(
      geo.getFeaturedCities('DZ').map((city) => city.code),
    );
    expect(pioneer.cities.every((c) => featured.has(c.city.code))).toBe(true);
    expect(pioneer.cities.some((c) => c.city.code === algiers.code)).toBe(
      false,
    );
  });

  it('leads with a city that has meetups however far down its state ranks', async () => {
    const db = createDb(env.DB);
    await seed(db);
    const constantine = dzCity('constantine');
    await seedMeetups(db, [
      [dzCity('algiers'), 4],
      [dzCity('oran'), 3],
      [dzCity('setif'), 2],
      [constantine, 1],
    ]);

    const trending = await resolveTrendingStates(db, 'DZ');
    const cards = trending.groups.flatMap((group) => group.cities);
    const upcoming = await countUpcomingByCity(db, 'DZ');

    expect(
      cards.map((card) => card.count),
      'every card says what the hero search says about its city',
    ).toEqual(cards.map((card) => upcoming[card.city.code] ?? 0));
    expect(
      trending.groups.find(
        (group) => group.state?.code === constantine.stateCode,
      )?.cities,
      'Constantine leads under its own state, the fourth by meetups',
    ).toMatchObject([
      {
        city: { slug: 'constantine' },
        count: 1,
        hosts: [{ name: host.name, photoAssetId: null }],
        hostCount: 1,
      },
    ]);
    expect(
      cards.map((card) => card.count),
      'busiest state first, and every state with meetups ahead of the invitations',
    ).toEqual([4, 3, 2, 1, 0, 0, 0, 0, 0, 0, 0]);
  });

  it('shows the meetups of a city that eight busier neighbours push among the invitations', async () => {
    const db = createDb(env.DB);
    await seed(db);
    const algiers = dzCity('algiers');
    const neighbours = geo
      .getCities('DZ', algiers.stateCode)
      .filter((city) => !city.featured)
      .slice(0, 8);
    await seedMeetups(db, [
      ...neighbours.map((city) => [city, 2] as const),
      [algiers, 1],
    ]);

    const trending = await resolveTrendingStates(db, 'DZ');
    const cards = trending.groups.flatMap((group) => group.cities);
    const upcoming = await countUpcomingByCity(db, 'DZ');

    expect(
      cards.map((card) => card.count),
      'every card says what the hero search says about its city',
    ).toEqual(cards.map((card) => upcoming[card.city.code] ?? 0));
    expect(
      trending.groups.find((group) => group.state === null)?.cities[0],
      'Algiers is ninth in its own state, so it comes first among the rest',
    ).toMatchObject({
      city: { slug: 'algiers' },
      count: 1,
      hosts: [{ name: host.name, photoAssetId: null }],
      hostCount: 1,
    });
  });
});
