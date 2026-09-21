import { and, eq, ne, sql } from 'drizzle-orm';

import type { Db } from './db.js';
import { eventFeedback, events } from './schema.js';

/**
 * The aggregate a host may see about their own gathering, which never includes who said what.
 *
 * It says a host and not an operator on purpose. The line here read "a host or an operator may
 * see" from the day it was written, in the present indicative, while this projection had no caller
 * anywhere — not in the public app, not in the operations console, which has no feedback surface of
 * any kind (#76). `readFeedbackTally` is now the one reader, and it answers the event's host alone.
 * When an operator surface exists this sentence can grow again; until then it describes what is
 * built, because a doc-block that promises a reader is how the gap survived review for as long as
 * it did.
 *
 * §5.7 keeps individual feedback private by default and out of public event pages entirely. The
 * comments are deliberately absent from this projection: a host reading three comments on a meetup
 * of four people has effectively been told who wrote them.
 *
 * The host's own row is excluded here as well as refused at the write. The write guard stops new
 * ones; this stops the ones already in the table, which are separable from an attendee's only by
 * joining back to `events.host_id` — so the join belongs in the one place the number is read rather
 * than in a backfill that would have to be trusted to have run. It also keeps the anonymity
 * argument above intact: a host inside their own tally can subtract their known answer from it,
 * which on a two-response meetup identifies the other respondent exactly.
 */
export const feedbackTally = async (
  db: Db,
  eventId: string,
): Promise<{
  responses: number;
  wouldReturn: number;
  valuable: number;
  okay: number;
  notValuable: number;
}> => {
  const rows = await db
    .select({
      responses: sql<number>`count(*)`.as('responses'),
      wouldReturn:
        sql<number>`sum(case when would_return = 1 then 1 else 0 end)`.as(
          'would_return',
        ),
      valuable:
        sql<number>`sum(case when value_rating = 'valuable' then 1 else 0 end)`.as(
          'valuable',
        ),
      okay: sql<number>`sum(case when value_rating = 'okay' then 1 else 0 end)`.as(
        'okay',
      ),
      notValuable:
        sql<number>`sum(case when value_rating = 'not_valuable' then 1 else 0 end)`.as(
          'not_valuable',
        ),
    })
    .from(eventFeedback)
    .innerJoin(events, eq(events.id, eventFeedback.eventId))
    .where(
      and(
        eq(eventFeedback.eventId, eventId),
        ne(eventFeedback.userId, events.hostId),
      ),
    );
  const row = rows[0];
  return {
    responses: row?.responses ?? 0,
    wouldReturn: row?.wouldReturn ?? 0,
    valuable: row?.valuable ?? 0,
    okay: row?.okay ?? 0,
    notValuable: row?.notValuable ?? 0,
  };
};
