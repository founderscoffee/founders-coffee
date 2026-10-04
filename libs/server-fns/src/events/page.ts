import { AppError, err, ok, type Result } from '@founders-coffee/core';
import { readEventPageRows, type Db, type Market } from '@founders-coffee/db';
import { reportError } from '@founders-coffee/observability';

import { resolveMarket } from '../markets/resolver.js';
import { ownerProfileOf, publicProfileOf } from '../profile/projection.js';
import type { PublicProfile } from '../profile/schemas.js';
import type { EventDetailItem } from './attendance.js';
import { eventDetail } from './detail.js';
import { availableEvent } from './resolver.js';
import type { EventPageRequestInput } from './schemas.js';

export interface EventPage {
  readonly market: Market;
  readonly event: EventDetailItem;
  readonly host: PublicProfile | null;
  readonly viewerId: string | null;
}

type PageRows = Awaited<ReturnType<typeof readEventPageRows>>;

/** Read the meetup and its host's rows, answering a failed read with a typed error. */
const pageRows = async (
  db: Db,
  input: EventPageRequestInput,
): Promise<Result<PageRows>> => {
  try {
    return ok(
      await readEventPageRows(db, input.marketCode, input.slug, new Date()),
    );
  } catch (error) {
    reportError(error, {
      operation: 'read_event_page',
      market: input.marketCode,
    });
    return err(
      new AppError('event_unavailable', 'The meetup could not be read'),
    );
  }
};

/**
 * The host's public card, or `null` when the host has none to show.
 *
 * A host with no public profile, an erased one among them, still leaves the meetup on its page as
 * the city's record (#105), so a missing card is an answer rather than a failure. The card is
 * built by the same steps as `readPublicProfile`, from the same rows.
 */
const hostCard = (
  hostId: string,
  host: PageRows['host'],
): PublicProfile | null => {
  const owner = ownerProfileOf(hostId, host.identity, host.stored);
  if (!owner.ok) return null;
  const card = publicProfileOf(owner.data, host);
  return card.ok ? card.data : null;
};

/**
 * Everything a meetup's page shows, in as few trips to D1 as its reads allow (#114).
 *
 * Each trip costs a round trip from where the Worker runs to the database's region, Madrid to
 * London for a reader in Algeria. The meetup and every row of its host's card come back in one
 * batch, read beside the market and the reader's session, so a reader who is signed out waits on
 * one trip here. One who is signed in waits on a second, for whether they are going, which needs
 * both the session and the meetup. Before this, the page read the meetup, then checked its host,
 * then read the host's profile, then counted the host's record, one after another.
 *
 * The session comes in as a promise so that it resolves alongside the first reads, and the host
 * card is read without the budget `getPublicProfile` spends. That budget stops somebody walking
 * user ids to collect profiles. This card is only ever the one a published meetup's page already
 * shows to anyone who opens it, reached by the meetup's address rather than by an id.
 *
 * The reader's id comes back with the page, `null` for a reader who is signed out. The page is
 * rendered for one reader (`private, no-store`), and whether they host the meetup has to be in the
 * HTML the server sends, as whether they are going already is. The browser's own session answers
 * only after hydration, and until it did, a host's own meetup showed them a guest's RSVP box.
 */
export const readEventPage = async (
  db: Db,
  input: EventPageRequestInput,
  viewer: Promise<string | undefined>,
): Promise<Result<EventPage>> => {
  const [market, rows, viewerId] = await Promise.all([
    resolveMarket(db, { code: input.marketCode }),
    pageRows(db, input),
    viewer,
  ]);
  if (!market.ok) return market;
  if (!rows.ok) return rows;
  const event = availableEvent(rows.data.event, input.slug);
  if (!event.ok) return event;
  return ok({
    market: market.data,
    event: await eventDetail(db, event.data, viewerId),
    host: hostCard(event.data.hostId, rows.data.host),
    viewerId: viewerId ?? null,
  });
};
