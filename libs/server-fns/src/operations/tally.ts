import { AppError, err, ok, type Result } from '@founders-coffee/core';
import {
  communityOperationsEnabled,
  feedbackTally,
  getEvent,
  type Db,
} from '@founders-coffee/db';

export const TALLY_FLOOR = 3;

export type FeedbackTallyView =
  | { readonly state: 'below_floor' }
  | {
      readonly state: 'shown';
      readonly responses: number;
      readonly wouldReturn: number;
      readonly valuable: number;
      readonly okay: number;
      readonly notValuable: number;
    };

/**
 * The attendee pulse on one gathering, for the host of that gathering and nobody else.
 *
 * This is the reader `feedbackTally`'s own doc-block has described since it was written and never
 * had: until now the projection was built, tested and reachable from nothing, so the product asked
 * attendees for a rating, promised to keep it for two years, and consumed none of it (#76).
 *
 * Owner-only by construction, like the closeout view beside it: the event's host is compared to the
 * session, so an event id in the request selects which of the caller's own gatherings to answer
 * about and never widens who may ask.
 *
 * `TALLY_FLOOR` is three because the host knows who was in the room. With two responses a host who
 * can guess one answer — the friend who said it was great on the way out — derives the other
 * exactly, which turns the aggregate back into the individual disclosure §5.7 forbids; three leaves
 * two unresolved. It is a floor and not a guarantee, and the difference is worth stating plainly:
 * unanimity discloses every answer at any size, so `3 valuable of 3` tells a host what each of
 * those three said. No threshold fixes that — it is inherent to publishing an aggregate — and
 * claiming otherwise would be the more dangerous line to leave here. What the floor does prevent is
 * the small-n subtraction, which is the attack a host is actually in a position to run.
 *
 * Below the floor the counts are not merely hidden from the page — they are never put in the
 * response. A suppression applied in the interface would leave the numbers sitting in a payload the
 * host can read in devtools, which is not suppression, and the anonymity claim above would be
 * false in exactly the case it is meant to cover.
 */
export const readFeedbackTally = async (
  db: Db,
  opts: { eventId: string; actorId: string },
): Promise<Result<FeedbackTallyView>> => {
  const event = await getEvent(db, opts.eventId);
  if (!event) return err(new AppError('event_not_found', 'Event not found'));
  if (event.hostId !== opts.actorId)
    return err(
      new AppError('event_not_host', 'Only the host can see this summary'),
    );
  if (!(await communityOperationsEnabled(db, event.marketCode)))
    return err(
      new AppError(
        'operations_disabled',
        'Community operations are not enabled in this market',
      ),
    );

  const tally = await feedbackTally(db, opts.eventId);
  return ok(
    tally.responses < TALLY_FLOOR
      ? { state: 'below_floor' }
      : { state: 'shown', ...tally },
  );
};
