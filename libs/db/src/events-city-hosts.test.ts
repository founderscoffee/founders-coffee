import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { countUpcomingByCity, createEvent } from './events.js';
import { listUpcomingCityHosts } from './events-city-hosts.js';
import { initializeMemberProfile } from './member-profiles.js';
import { memberProfiles, profileAssets, user } from './schema.js';
import { baseEvent, nextId, nextSlug, setupDb } from './events.fixtures.js';

const NOW = new Date('2026-06-15T12:00:00Z');
const day = (n: number) => new Date(NOW.getTime() + n * 24 * 60 * 60 * 1000);

type TestDb = Awaited<ReturnType<typeof setupDb>>;

const addHost = async (db: TestDb, id: string, name = `Host ${id}`) => {
  await db
    .insert(user)
    .values({ id, name, email: `${id}@test.coffee` })
    .onConflictDoNothing()
    .run();
  return id;
};

const hostMeetup = (
  db: TestDb,
  hostId: string,
  cityCode: string,
  startsAt: Date,
  overrides: Partial<Parameters<typeof createEvent>[1]> = {},
) =>
  createEvent(db, {
    ...baseEvent,
    id: nextId(),
    slug: nextSlug(),
    hostId,
    cityCode,
    stateCode: cityCode,
    startsAt,
    ...overrides,
  });

const rowsIn = async (db: TestDb, cityCode: string) =>
  (await listUpcomingCityHosts(db, 'DZ', NOW)).filter(
    (row) => row.cityCode === cityCode,
  );

const hostsIn = async (db: TestDb, cityCode: string) =>
  (await rowsIn(db, cityCode)).map((row) => row.hostId);

describe('the hosts of a city’s upcoming meetups (real D1)', () => {
  it('names each host once per city, the one hosting soonest first', async () => {
    const db = await setupDb();
    const city = 'hosts-order';
    const elsewhere = 'hosts-order-other';
    const early = await addHost(db, 'usr_ch_early');
    const twice = await addHost(db, 'usr_ch_twice');
    const lateA = await addHost(db, 'usr_ch_late_a');
    const lateB = await addHost(db, 'usr_ch_late_b');
    await hostMeetup(db, lateB, city, day(9));
    await hostMeetup(db, twice, city, day(12));
    await hostMeetup(db, early, city, day(2));
    await hostMeetup(db, lateA, city, day(9));
    await hostMeetup(db, twice, city, day(4));
    await hostMeetup(db, twice, elsewhere, day(30));

    expect(
      await hostsIn(db, city),
      'a host with two meetups in the city is placed by the sooner one, and named once',
    ).toEqual([early, twice, lateA, lateB]);
    expect(await hostsIn(db, elsewhere)).toEqual([twice]);
  });

  it('leaves out every meetup the city count leaves out', async () => {
    const db = await setupDb();
    const city = 'hosts-scope';
    const counted = await addHost(db, 'usr_ch_counted');
    const ended = await addHost(db, 'usr_ch_ended');
    const cancelled = await addHost(db, 'usr_ch_cancelled');
    const abroad = await addHost(db, 'usr_ch_abroad');
    const banned = await addHost(db, 'usr_ch_banned');
    await hostMeetup(db, counted, city, day(3));
    await hostMeetup(db, ended, city, day(-2));
    await hostMeetup(db, cancelled, city, day(3), { status: 'cancelled' });
    await hostMeetup(db, abroad, city, day(3), { marketCode: 'EG' });
    await hostMeetup(db, banned, city, day(3));
    await db.update(user).set({ banned: true }).where(eq(user.id, banned));

    expect(await hostsIn(db, city)).toEqual([counted]);
    expect(
      (await countUpcomingByCity(db, 'DZ', NOW))[city],
      'the card’s number and its faces must describe the same meetups',
    ).toBe(1);
  });

  it('carries the name and the photo a public profile shows', async () => {
    const db = await setupDb();
    const city = 'hosts-faces';
    const pictured = await addHost(db, 'usr_ch_pictured', 'Pictured Host');
    const plain = await addHost(db, 'usr_ch_plain', 'Plain Host');
    await initializeMemberProfile(db, pictured);
    await db.insert(profileAssets).values({
      id: 'ast_ch_pictured',
      userId: pictured,
      objectKey: 'profiles/ch-pictured.webp',
      status: 'ready',
      expiresAt: new Date('2099-01-01'),
    });
    await db
      .update(memberProfiles)
      .set({ photoAssetId: 'ast_ch_pictured' })
      .where(eq(memberProfiles.userId, pictured));
    await hostMeetup(db, pictured, city, day(1));
    await hostMeetup(db, plain, city, day(2));

    expect(await rowsIn(db, city)).toEqual([
      {
        cityCode: city,
        hostId: pictured,
        name: 'Pictured Host',
        photoAssetId: 'ast_ch_pictured',
      },
      { cityCode: city, hostId: plain, name: 'Plain Host', photoAssetId: null },
    ]);
  });
});
