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
  listUpcomingEvents,
  type Db,
  type Event,
  type NewEvent,
} from '@founders-coffee/db';
import { reportError } from '@founders-coffee/observability';

import type { MapProvider, VenueKind } from '../maps/provider.js';
import { reverseEventVenueResolver } from '../maps/resolver.js';
import { type EventAttendance } from './attendance.js';

/**
 * The name an event is published under, given what the map provider could verify.
 *
 * A point of interest names itself, and taking the provider's name is what stops a host publishing
 * "Café des Délices" at a location that is really somewhere else. Where the provider can only
 * confirm a street address — which is every location in the Maghreb, since Mapbox indexes no points
 * of interest there — the label has to come from the host, because "15 Rue Yousfi Mohamed" tells an
 * attendee nothing about which door to walk through. The guarantee splits rather than disappears:
 * the address and coordinates stay provider-verified and inside the selected city, while the name
 * becomes host-authored content held to the same schema bounds as the title and description.
 */
const resolvedVenueName = (
  resolved: { readonly kind: VenueKind; readonly name: string },
  submitted: string,
): string => (resolved.kind === 'poi' ? resolved.name : submitted);

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

    const venueValidation = await reverseEventVenueResolver(mapProvider, {
      marketCode: input.marketCode,
      cityCode: input.cityCode,
      locale: input.language,
      latitude: input.latitude,
      longitude: input.longitude,
    });
    if (!venueValidation.ok) return venueValidation;

    const row: Omit<NewEvent, 'slug'> = {
      id: eventId,
      hostId,
      marketCode: market.code,
      stateCode: state.code,
      cityCode: city.code,
      title: input.title,
      description: input.description,
      venue: resolvedVenueName(venueValidation.data, input.venueName),
      venueAddress: venueValidation.data.address,
      latitude: venueValidation.data.latitude,
      longitude: venueValidation.data.longitude,
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

export type EventFeedItemBase = Event & {
  readonly cityName: string;
  readonly cityNameAr: string;
};

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
