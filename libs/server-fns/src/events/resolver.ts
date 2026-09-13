import { AppError, err, id, ok, type Result } from '@founders-coffee/core';
import {
  events as eventsDomain,
  geo,
  markets,
  type EventCreateInput,
} from '@founders-coffee/domain';
import {
  createEventIfRouteAvailable,
  getEvent,
  getEventBySlug,
  getMarketByCode,
  isVisibleIdentity,
  listUpcomingEvents,
  type Db,
  type Event,
  type NewEvent,
} from '@founders-coffee/db';
import { reportError } from '@founders-coffee/observability';

import { attendHostOwnEvent } from './host-attendance.js';
import { locatePoint, type LocatedPoint } from '../maps/locate.js';
import type { MapProvider } from '../maps/provider.js';
import { type EventAttendance } from './attendance.js';

/**
 * Where this event is, and the address to publish with it.
 *
 * The point the host chose is the location; the city and state are labels derived from it so the
 * per-state counts describe where events actually are rather than where a host said they were. A
 * host may override the city on the confirmation step, and an override is trusted only far enough
 * to name a city inside this market — the state still comes from the city, never from the client.
 *
 * The venue *name* stays host-authored. Mapbox indexes almost no points of interest in the Maghreb,
 * so a provider name is unavailable exactly where it would be most useful, and "15 Rue Yousfi
 * Mohamed" tells an attendee nothing about which door to walk through.
 */
const eventLocation = async (
  mapProvider: MapProvider,
  input: EventCreateInput,
): Promise<Result<LocatedPoint>> => {
  const located = await locatePoint(mapProvider, {
    marketCode: input.marketCode,
    locale: input.language,
    latitude: input.latitude,
    longitude: input.longitude,
    snapshotProviderId: input.venueProviderId,
    fallbackAddress: input.venueAddress,
  });
  if (!located.ok || !input.cityCode) return located;

  const chosen = geo.findCity(input.marketCode, input.cityCode);
  if (!chosen) {
    return err(
      new AppError(
        'validation_failed',
        `Unknown city ${input.cityCode} for ${input.marketCode}`,
      ),
    );
  }
  return ok({
    ...located.data,
    stateCode: chosen.stateCode,
    cityCode: chosen.code,
  });
};

const slugify = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');

const MAX_EVENT_SLUG_LENGTH = 80;

export const eventSlugCandidates = (
  title: string,
  eventId: string,
): readonly [string, string] => {
  const base = slugify(title) || 'event';
  const suffix = eventId.replace(/^evt_/, '').toLowerCase();
  const suffixedBase = base.slice(
    0,
    Math.max(1, MAX_EVENT_SLUG_LENGTH - suffix.length - 1),
  );
  return [base, `${suffixedBase}-${suffix}`];
};

/**
 * Validate + create a new event. Generates the id + slug, requires an enabled visible D1 market,
 * resolves canonical geo state/city, verifies the venue, and inserts the complete free-event row.
 */
export const createEventResolverWithId = async (
  db: Db,
  mapProvider: MapProvider,
  hostId: string,
  input: EventCreateInput,
  eventId: string,
): Promise<Result<Event>> => {
  try {
    const market = await getMarketByCode(db, input.marketCode);
    if (!market || !markets.isMarketVisible(market.state)) {
      return err(
        new AppError(
          'event_market_unavailable',
          'Event creation is unavailable in this market',
        ),
      );
    }
    if (!market.featureFlags.events) {
      return err(
        new AppError(
          'event_creation_disabled',
          'Event creation is currently disabled in this market',
        ),
      );
    }

    const located = await eventLocation(mapProvider, input);
    if (!located.ok) return located;

    const row: Omit<NewEvent, 'slug'> = {
      id: eventId,
      hostId,
      marketCode: market.code,
      stateCode: located.data.stateCode,
      cityCode: located.data.cityCode,
      title: input.title,
      description: input.description,
      venue: input.venueName,
      venueAddress: located.data.address,
      latitude: input.latitude,
      longitude: input.longitude,
      startsAt: new Date(input.startsAt),
      endsAt: new Date(input.endsAt),
      language: input.language,
      status: 'published',
    };

    for (const slug of eventSlugCandidates(input.title, eventId)) {
      const created = await createEventIfRouteAvailable(db, { ...row, slug });
      if (created) {
        await attendHostOwnEvent(db, created.id, hostId);
        return ok(created);
      }
    }

    return err(
      new AppError(
        'event_route_conflict',
        `Unable to reserve an event route in ${input.marketCode}`,
      ),
    );
  } catch (error) {
    reportError(error, {
      operation: 'create_event',
      market: input.marketCode,
      city: input.cityCode,
    });
    return err(
      new AppError('event_creation_failed', 'The event could not be created'),
    );
  }
};

export const createEventResolver = async (
  db: Db,
  mapProvider: MapProvider,
  hostId: string,
  input: EventCreateInput,
): Promise<Result<Event>> =>
  createEventResolverWithId(db, mapProvider, hostId, input, id('evt'));

/**
 * Resolve a single event by id or by (marketCode + slug). Returns `event_not_found` on miss.
 *
 * A suppressed host's event answers the same way as one that never existed. The feed already drops
 * those rows in SQL; without the same rule here the link would simply have to be typed rather than
 * clicked, which is not a restriction.
 */
export const resolveEvent = async (
  db: Db,
  input: { id?: string; marketCode?: string; slug?: string },
): Promise<Result<Event>> => {
  const event = input.id
    ? await getEvent(db, input.id)
    : input.marketCode && input.slug
      ? await getEventBySlug(db, input.marketCode, input.slug)
      : undefined;
  if (!event) {
    return err(
      new AppError(
        'event_not_found',
        `No event for ${input.id ?? input.slug ?? '(none)'}`,
      ),
    );
  }
  if (
    event.status !== 'published' &&
    !eventsDomain.canTransition(event.status, 'published')
  ) {
    return err(
      new AppError('event_not_found', `Event ${event.id} is not available`),
    );
  }
  if (!(await isVisibleIdentity(db, event.hostId))) {
    return err(
      new AppError('event_not_found', `Event ${event.id} is not available`),
    );
  }
  return ok(event);
};

export type EventFeedItemBase = Event & {
  readonly cityName: string;
  readonly cityNameAr: string;
  readonly citySlug: string | null;
};

export type EventFeedItem = EventFeedItemBase & Partial<EventAttendance>;

/**
 * Attach the display names and the slug the city route is keyed by.
 *
 * The slug is not the city code: `/{market}/{city}` resolves through `findCityBySlug`, so linking
 * with a code produces a 404. Carrying it on the payload is what lets a component link back to a
 * city without reaching into the domain itself.
 */
export const attachCityNames = (rows: readonly Event[]): EventFeedItemBase[] =>
  rows.map((e) => {
    const city = geo.findCity(e.marketCode, e.cityCode);
    return {
      ...e,
      cityName: city?.name ?? e.cityCode,
      cityNameAr: city?.nameAr ?? city?.name ?? e.cityCode,
      citySlug: city?.slug ?? null,
    };
  });

export interface EventFeedPage {
  readonly items: readonly EventFeedItemBase[];
  readonly nextCursor: {
    readonly startsAt: number;
    readonly id: string;
  } | null;
}

export type EventFeedCursor = NonNullable<EventFeedPage['nextCursor']>;

/** List upcoming published events, optionally scoped to a market/city (composite cursor). */
export const listEvents = async (
  db: Db,
  opts: {
    marketCode?: string;
    cityCode?: string;
    hostId?: string;
    afterStartsAt?: number;
    afterId?: string;
    limit?: number;
  } = {},
): Promise<EventFeedPage> => {
  const limit = opts.limit ?? 20;
  const rows = await listUpcomingEvents(db, {
    marketCode: opts.marketCode,
    cityCode: opts.cityCode,
    hostId: opts.hostId,
    afterStartsAt: opts.afterStartsAt
      ? new Date(opts.afterStartsAt)
      : undefined,
    afterId: opts.afterId,
    limit: limit + 1,
  });
  const items = attachCityNames(rows.slice(0, limit));
  const hasMore = rows.length > limit;
  const last = items[items.length - 1];
  return {
    items,
    nextCursor:
      hasMore && last
        ? { startsAt: last.startsAt.getTime(), id: last.id }
        : null,
  };
};
