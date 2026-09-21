import { and, eq } from 'drizzle-orm';

import type { Db } from './db.js';
import { upcomingScope } from './events.js';
import { visibleIdentity } from './profile-access.js';
import { events, type Event } from './schema.js';

export type PublicEventSitemapRow = Pick<
  Event,
  'marketCode' | 'cityCode' | 'slug' | 'updatedAt'
>;

/**
 * The cities that currently have something to show, for the sitemap.
 *
 * Deliberately the same predicate the city page decides its own indexability with — `upcomingScope`
 * plus `published`, which is what `listUpcomingEvents` applies — because the two have to agree.
 * `cityPageHead` answers `noindex,follow` for a city with no upcoming events, so a sitemap built
 * from the geo catalogue instead advertised every city in it: 6,520 of them across three markets,
 * times three locales, of which all but a handful told Google not to index them the moment it
 * arrived (#82).
 *
 * It is not enough to filter the event rows the sitemap already loads. Those are every published
 * event including finished ones, because an event page stays indexable after the fact; a city whose
 * only gathering is over is empty again and must drop back out.
 */
export const listCitiesWithUpcomingEvents = async (
  db: Db,
  now: Date = new Date(),
): Promise<{ marketCode: string; cityCode: string }[]> =>
  db
    .selectDistinct({
      marketCode: events.marketCode,
      cityCode: events.cityCode,
    })
    .from(events)
    .where(and(upcomingScope(now), eq(events.status, 'published')))
    .orderBy(events.marketCode, events.cityCode);

export const listPublicEventSitemapRows = async (
  db: Db,
): Promise<PublicEventSitemapRow[]> =>
  db
    .select({
      marketCode: events.marketCode,
      cityCode: events.cityCode,
      slug: events.slug,
      updatedAt: events.updatedAt,
    })
    .from(events)
    .where(and(eq(events.status, 'published'), visibleIdentity(events.hostId)))
    .orderBy(events.updatedAt, events.id);
