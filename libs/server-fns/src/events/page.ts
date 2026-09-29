import { ok, type Result } from '@founders-coffee/core';
import type { Db, Market } from '@founders-coffee/db';

import { resolveMarket } from '../markets/resolver.js';
import { readPublicProfile } from '../profile/resolver.js';
import type { PublicProfile } from '../profile/schemas.js';
import type { EventDetailItem } from './attendance.js';
import { eventDetail } from './detail.js';
import { resolveEvent } from './resolver.js';
import type { EventPageRequestInput } from './schemas.js';

export interface EventPage {
  readonly market: Market;
  readonly event: EventDetailItem;
  readonly host: PublicProfile | null;
}

/**
 * The host's public card, or `null` when the host has none to show.
 *
 * A host with no public profile, an erased one among them, still leaves the meetup on its page as
 * the city's record (#105), so a missing card is an answer rather than a failure. Anything else the
 * profile read refuses is still a failure.
 */
const hostCard = async (
  db: Db,
  hostId: string,
): Promise<Result<PublicProfile | null>> => {
  const card = await readPublicProfile(db, hostId);
  if (!card.ok && card.error.code === 'not_found') return ok(null);
  return card;
};

/**
 * Everything a meetup's page shows, in as few trips to D1 as its reads allow (#114).
 *
 * The page's loader used to await three server functions in turn, the market, the meetup and then
 * its host's card, and each waited on its own reads: six trips one after another for a reader who
 * is signed out, one of them to a Durable Object, and nine for one who is signed in. That missed
 * the 300 ms budget. The market, the meetup and the reader's session need nothing from each other,
 * so they are read together; whether the reader is going and who is hosting need the meetup, so
 * they are read together next. That leaves four trips for either reader.
 *
 * The session comes in as a promise so that it resolves alongside the first reads, and the host
 * card is read without the budget `getPublicProfile` spends. That budget stops somebody walking
 * user ids to collect profiles. This card is only ever the one a published meetup's page already
 * shows to anyone who opens it, reached by the meetup's address rather than by an id.
 */
export const readEventPage = async (
  db: Db,
  input: EventPageRequestInput,
  viewer: Promise<string | undefined>,
): Promise<Result<EventPage>> => {
  const [market, event, viewerId] = await Promise.all([
    resolveMarket(db, { code: input.marketCode }),
    resolveEvent(db, input),
    viewer,
  ]);
  if (!market.ok) return market;
  if (!event.ok) return event;
  const [detail, host] = await Promise.all([
    eventDetail(db, event.data, viewerId),
    hostCard(db, event.data.hostId),
  ]);
  if (!host.ok) return host;
  return ok({ market: market.data, event: detail, host: host.data });
};
