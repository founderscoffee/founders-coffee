import { sql, type SQL } from 'drizzle-orm';

import { activeProfileIdentity, visibleHost } from './profile-access.js';
import { eventRsvps, events, markets, user } from './schema.js';

/**
 * Whether `userId` belongs to the chat of the meetup in the statement's `events` row (P1-026).
 *
 * The one rule for every read, write and socket. A member is the meetup's host, by
 * `events.host_id` rather than by the host's own RSVP, which is written best-effort, or has a
 * `going` RSVP for it; nothing is written when someone joins, because the RSVP is the membership,
 * and deleting it on a cancellation is what removes them. Their account must be active and not
 * banned, through {@link activeProfileIdentity}, since the chat does not trust the RSVP for that.
 * And the meetup must still stand by its host, through {@link visibleHost}: a suppressed host takes
 * the chat with the meetup's page, the way the page and the lists already go.
 *
 * A chat switched off in its market has no members at all. The `meetupChat` flag is read here, as
 * JSON `true` and nothing else, so no surface can reach a chat its market has not opened by
 * forgetting to ask, and switching it off closes every chat in the market at once.
 */
export const isChatMember = (userId: string): SQL => sql`(
  EXISTS (
    SELECT 1 FROM ${markets}
    WHERE ${markets.code} = ${events.marketCode}
      AND json_type(${markets.featureFlags}, '$.meetupChat') = 'true'
  )
  AND (${events.hostId} = ${userId}
    OR EXISTS (
      SELECT 1 FROM ${eventRsvps}
      WHERE ${eventRsvps.eventId} = ${events.id}
        AND ${eventRsvps.userId} = ${userId}
        AND ${eventRsvps.status} = 'going'
    ))
  AND EXISTS (SELECT 1 FROM ${user} WHERE ${activeProfileIdentity(userId)})
  AND ${visibleHost(events.hostId)}
)`;
