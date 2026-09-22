import { eq } from 'drizzle-orm';

import type { Db } from './db.js';
import { events, markets, user } from './schema.js';

/**
 * The handful of public fields a social card draws, with the host's name, in one query.
 *
 * Narrower than `getEvent` on purpose. The card is rendered for whoever is scraping a shared link,
 * which is nobody in particular, so it must never carry a field that depends on who is asking;
 * selecting the columns by name rather than taking the row is what makes that true by construction
 * instead of by review.
 *
 * `version` comes along because it is what the card's address is keyed on: a title that changes
 * has to produce a different URL, or the image an edited meetup shares is the one it had before.
 */
export const getEventCard = async (
  db: Db,
  id: string,
): Promise<
  | {
      title: string;
      startsAt: Date;
      marketCode: string;
      cityCode: string;
      status: string;
      version: number;
      hostName: string;
      timezone: string;
    }
  | undefined
> => {
  const rows = await db
    .select({
      title: events.title,
      startsAt: events.startsAt,
      marketCode: events.marketCode,
      cityCode: events.cityCode,
      status: events.status,
      version: events.version,
      hostName: user.name,
      timezone: markets.timezone,
    })
    .from(events)
    .innerJoin(user, eq(events.hostId, user.id))
    .innerJoin(markets, eq(events.marketCode, markets.code))
    .where(eq(events.id, id))
    .limit(1);
  return rows[0];
};
