import { id } from '@founders-coffee/core';
import { createRsvp, type Db } from '@founders-coffee/db';
import { logger, reportError } from '@founders-coffee/observability';

/**
 * Enrol the host as an attendee of the event they just created.
 *
 * A host is at their own meetup by definition, so the alternative — a chip the page draws because
 * the viewer happens to be the host — would leave `rsvps` reading zero for a table that has at
 * least one person at it, and the live roster empty of the one person certain to be there. Writing
 * the row makes the count and the roster true instead of decorated.
 *
 * A failure here does not fail the creation. The event is already durably committed and belongs to
 * the host either way; losing the attendee row costs an accurate count, and taking the event away
 * from them to protect that count would be the worse trade. It is logged so an environment where
 * it happens routinely is visible rather than silently undercounting.
 */
export const attendHostOwnEvent = async (
  db: Db,
  eventId: string,
  hostId: string,
): Promise<void> => {
  try {
    const { outcome } = await createRsvp(db, {
      id: id('rsv'),
      eventId,
      userId: hostId,
    });
    if (outcome !== 'created') {
      logger.warn('host_self_rsvp_skipped', { eventId, hostId, outcome });
    }
  } catch (error) {
    reportError(error, { operation: 'host_self_rsvp', eventId });
  }
};
