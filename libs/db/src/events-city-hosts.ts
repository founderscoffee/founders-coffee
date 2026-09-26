import { alias } from 'drizzle-orm/sqlite-core';
import { and, eq, sql } from 'drizzle-orm';

import type { Db } from './db.js';
import { upcomingScope } from './events.js';
import { events, memberProfiles, user } from './schema.js';

export type UpcomingCityHost = {
  readonly cityCode: string;
  readonly hostId: string;
  readonly name: string;
  readonly photoAssetId: string | null;
};

/**
 * Everyone hosting an upcoming meetup in a market, once for each city they host in.
 *
 * Rows come city by city and, within a city, in the order of each host's next meetup there, so the
 * first rows of a city are the people hosting soonest. The scope is the city count's own: published,
 * not yet over, and a visible host through {@link upcomingScope}. A city card that shows these faces
 * beside that count therefore cannot show a face for a meetup the count leaves out.
 *
 * The name and photo are the ones {@link listPublicEventHosts} publishes for a host. They are grouped
 * on as well as selected so that each row is one host in one city without leaning on SQLite's bare
 * columns, and the joined identity is aliased because `upcomingScope` asks its own question of
 * `user` in a subquery that must not read this row's copy.
 */
export const listUpcomingCityHosts = async (
  db: Db,
  marketCode: string,
  now?: Date,
): Promise<UpcomingCityHost[]> => {
  const host = alias(user, 'city_host');
  return db
    .select({
      cityCode: events.cityCode,
      hostId: events.hostId,
      name: host.name,
      photoAssetId: memberProfiles.photoAssetId,
    })
    .from(events)
    .innerJoin(host, eq(host.id, events.hostId))
    .leftJoin(memberProfiles, eq(memberProfiles.userId, events.hostId))
    .where(
      and(
        eq(events.marketCode, marketCode),
        eq(events.status, 'published'),
        upcomingScope(now ?? new Date()),
      ),
    )
    .groupBy(
      events.cityCode,
      events.hostId,
      host.name,
      memberProfiles.photoAssetId,
    )
    .orderBy(events.cityCode, sql`min(${events.startsAt})`, events.hostId);
};
