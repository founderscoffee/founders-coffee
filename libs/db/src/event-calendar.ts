import { eq } from 'drizzle-orm';

import type { Db } from './db.js';
import { events, markets } from './schema.js';

/**
 * What a calendar entry for an event says, with the clock of the market it happens in, in one
 * query.
 *
 * The entry is fetched by a calendar app or a download, without a session, so it answers the same
 * for everyone and must never carry a field that depends on who is asking. Naming the columns
 * rather than taking the row is what keeps the host and the attendance out of it by construction.
 *
 * `version` and `updatedAt` come along because they are how a calendar tells a newer copy of an
 * entry it already holds from the one it has.
 */
export const getEventCalendar = async (
  db: Db,
  id: string,
): Promise<
  | {
      title: string;
      description: string;
      language: (typeof events.$inferSelect)['language'];
      venue: string;
      venueAddress: string | null;
      latitude: number | null;
      longitude: number | null;
      startsAt: Date;
      endsAt: Date | null;
      status: string;
      version: number;
      updatedAt: Date;
      timezone: string;
    }
  | undefined
> => {
  const rows = await db
    .select({
      title: events.title,
      description: events.description,
      language: events.language,
      venue: events.venue,
      venueAddress: events.venueAddress,
      latitude: events.latitude,
      longitude: events.longitude,
      startsAt: events.startsAt,
      endsAt: events.endsAt,
      status: events.status,
      version: events.version,
      updatedAt: events.updatedAt,
      timezone: markets.timezone,
    })
    .from(events)
    .innerJoin(markets, eq(events.marketCode, markets.code))
    .where(eq(events.id, id))
    .limit(1);
  return rows[0];
};
