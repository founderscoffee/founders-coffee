import { AppError, err, id, ok, type Result } from '@founders-coffee/core';
import {
  events as eventsDomain,
  geo,
  type EventCreateInput,
} from '@founders-coffee/domain';
import {
  createEventIfRouteAvailable,
  getEvent,
  getEventBySlug,
  listUpcomingEvents,
  type Db,
  type Event,
  type NewEvent,
} from '@founders-coffee/db';

import { type EventAttendance } from './attendance.js';

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
 * Validate + create a new event. Generates the id + slug, validates the geo state/city against the
 * TS data, and inserts the row. Returns the created Event.
 */
export const createEventResolverWithId = async (
  db: Db,
  hostId: string,
  input: EventCreateInput,
  eventId: string,
): Promise<Result<Event>> => {
  const city = geo.findCity(input.marketCode, input.cityCode);
  if (!city) {
    return err(
      new AppError(
        'validation_failed',
        `Unknown city ${input.cityCode} for ${input.marketCode}`,
      ),
    );
  }
  const state = geo.findState(input.marketCode, city.stateCode);
  if (!state) {
    return err(
      new AppError(
        'validation_failed',
        `Unknown state ${city.stateCode} for ${input.marketCode}`,
      ),
    );
  }

  const row: Omit<NewEvent, 'slug'> = {
    id: eventId,
    hostId,
    marketCode: input.marketCode,
    stateCode: city.stateCode,
    cityCode: input.cityCode,
    title: input.title,
    description: input.description,
    venue: input.venueName,
    venueAddress: input.venueAddress,
    latitude: input.latitude,
    longitude: input.longitude,
    startsAt: new Date(input.startsAt),
    endsAt: new Date(input.endsAt),
    capacity: input.capacity,
    language: input.language,
    category: input.category,
    isFree: true,
    status: 'published',
  };

  for (const slug of eventSlugCandidates(input.title, eventId)) {
    const created = await createEventIfRouteAvailable(db, { ...row, slug });
    if (created) return ok(created);
  }

  return err(
    new AppError(
      'event_route_conflict',
      `Unable to reserve an event route in ${input.marketCode}`,
    ),
  );
};

export const createEventResolver = async (
  db: Db,
  hostId: string,
  input: EventCreateInput,
): Promise<Result<Event>> =>
  createEventResolverWithId(db, hostId, input, id('evt'));

/** Resolve a single event by id or by (marketCode + slug). Returns `event_not_found` on miss. */
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
  return ok(event);
};

/**
 * A feed event with display city names attached server-side. The geo dataset is server-only —
 * resolving city names in the client would bundle the full 6,518-city dataset into the UI build.
 * This is the resolver-layer type; the RPC layer enriches it with attendance fields.
 */
export type EventFeedItemBase = Event & {
  readonly cityName: string;
  readonly cityNameAr: string;
};

/**
 * A feed event with display city names + optional attendance fields.
 * The resolver produces items WITHOUT attendance; the RPC layer enriches them
 * via `attachAttendance`. UI components should guard: `event.goingCount != null`.
 */
export type EventFeedItem = EventFeedItemBase & Partial<EventAttendance>;

/** Attach display city names (falls back to the city code if the geo record is missing). */
const attachCityNames = (rows: readonly Event[]): EventFeedItemBase[] =>
  rows.map((e) => {
    const city = geo.findCity(e.marketCode, e.cityCode);
    return {
      ...e,
      cityName: city?.name ?? e.cityCode,
      cityNameAr: city?.nameAr ?? city?.name ?? e.cityCode,
    };
  });

export interface EventFeedPage {
  readonly items: readonly EventFeedItemBase[];
  readonly nextCursor: {
    readonly startsAt: number;
    readonly id: string;
  } | null;
}

/** List upcoming published events, optionally scoped to a market/city (composite cursor). */
export const listEvents = async (
  db: Db,
  opts: {
    marketCode?: string;
    cityCode?: string;
    afterStartsAt?: number;
    afterId?: string;
    limit?: number;
  } = {},
): Promise<EventFeedPage> => {
  const limit = opts.limit ?? 20;
  const rows = await listUpcomingEvents(db, {
    marketCode: opts.marketCode,
    cityCode: opts.cityCode,
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
