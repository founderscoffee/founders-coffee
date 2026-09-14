import { and, eq, inArray, isNotNull, lte, ne } from 'drizzle-orm';

import type { Db } from './db.js';
import { eventCloseouts, events } from './schema.js';

export interface CloseoutState {
  readonly eventId: string;
  readonly marketCode: string;
  readonly closed: boolean;
  readonly outcome: 'held' | 'did_not_happen' | null;
}

/**
 * Which of these events the host could still close out, and which they already did.
 *
 * `/activity` offered every past hosted event a "Close it out" link whether or not one existed, so a
 * host who had closed one out was invited to do it again and the page never acknowledged the work.
 * The list carries no closeout state because it is the same query a public profile reads, and adding
 * one there would publish, to anyone, which of a host's gatherings they had admitted did not happen.
 * So the state is asked for separately, by the host, about events the host names.
 *
 * Scoped by `host_id` in the `WHERE` rather than trusted from the caller: the ids arrive from the
 * browser, and an id belonging to somebody else simply does not come back.
 *
 * The same conditions the write enforces are applied here, so the link is offered only where it
 * could succeed — over, not cancelled, and with a recorded end. An event failing any of them is
 * absent from the result rather than present and false, because "nothing to offer" and "offer it
 * again" are different answers and the caller has to be able to tell them apart. The market travels
 * with each row so the caller can apply the community-operations flag without a second read of the
 * events table.
 */
export const listCloseoutStates = async (
  db: Db,
  opts: { hostId: string; eventIds: readonly string[]; now?: Date },
): Promise<CloseoutState[]> => {
  if (opts.eventIds.length === 0) return [];

  const rows = await db
    .select({
      eventId: events.id,
      marketCode: events.marketCode,
      outcome: eventCloseouts.outcome,
      closedId: eventCloseouts.eventId,
    })
    .from(events)
    .leftJoin(eventCloseouts, eq(eventCloseouts.eventId, events.id))
    .where(
      and(
        eq(events.hostId, opts.hostId),
        inArray(events.id, [...opts.eventIds]),
        isNotNull(events.endsAt),
        ne(events.status, 'cancelled'),
        lte(events.endsAt, opts.now ?? new Date()),
      ),
    );

  return rows.map((row) => ({
    eventId: row.eventId,
    marketCode: row.marketCode,
    closed: row.closedId !== null,
    outcome: row.outcome,
  }));
};
