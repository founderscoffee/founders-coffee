import { AppError, err, id, ok, type Result } from '@founders-coffee/core';
import { events as eventsDomain, geo } from '@founders-coffee/domain';
import {
  createEvent as createEventRow,
  getEvent,
  getEventBySlug,
  isSlugTaken,
  listUpcomingEvents,
  type Db,
  type Event,
  type NewEvent,
} from '@founders-coffee/db';

const slugify = (title: string): string =>
  title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .slice(0, 60)
    .replace(/^-+|-+$/g, '');

const randomSuffix = (): string => Math.random().toString(36).slice(2, 6);

const generateUniqueSlug = async (db: Db, marketCode: string, title: string): Promise<string> => {
  const base = slugify(title) || 'event';
  let slug = base;
  let attempts = 0;
  while (await isSlugTaken(db, marketCode, slug)) {
    slug = `${base}-${randomSuffix()}`;
    attempts += 1;
    if (attempts > 10) {
      slug = `${base}-${Date.now().toString(36)}`;
      break;
    }
  }
  return slug;
};

export interface EventCreateInput {
  marketCode: string;
  stateCode: string;
  cityCode: string;
  title: string;
  description: string;
  venue: string;
  startsAt: number;
  capacity: number;
  language: string;
  category: string;
}

/**
 * Validate + create a new event. Generates the id + slug, validates the geo state/city against the
 * TS data, and inserts the row. Returns the created Event.
 */
export const createEventResolver = async (
  db: Db,
  hostId: string,
  input: EventCreateInput,
): Promise<Result<Event>> => {
  const state = geo.findState(input.marketCode, input.stateCode);
  if (!state) {
    return err(new AppError('validation_failed', `Unknown state ${input.stateCode} for ${input.marketCode}`));
  }
  const city = geo.findCity(input.marketCode, input.cityCode);
  if (!city) {
    return err(new AppError('validation_failed', `Unknown city ${input.cityCode} for ${input.marketCode}`));
  }

  const slug = await generateUniqueSlug(db, input.marketCode, input.title);
  const row: NewEvent = {
    id: id('evt'),
    hostId,
    marketCode: input.marketCode,
    stateCode: input.stateCode,
    cityCode: input.cityCode,
    title: input.title,
    description: input.description,
    venue: input.venue,
    startsAt: new Date(input.startsAt),
    capacity: input.capacity,
    language: input.language as NewEvent['language'],
    category: input.category as NewEvent['category'],
    isFree: true,
    slug,
    status: 'published',
  };

  const created = await createEventRow(db, row);
  return ok(created);
};

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
    return err(new AppError('event_not_found', `No event for ${input.id ?? input.slug ?? '(none)'}`));
  }
  if (event.status !== 'published' && !eventsDomain.canTransition(event.status, 'published')) {
    return err(new AppError('event_not_found', `Event ${event.id} is not available`));
  }
  return ok(event);
};

/** List upcoming published events, optionally scoped to a market/city (cursor-based). */
export const listEvents = async (
  db: Db,
  opts: { marketCode?: string; cityCode?: string; after?: number; limit?: number } = {},
): Promise<Event[]> =>
  listUpcomingEvents(db, {
    marketCode: opts.marketCode,
    cityCode: opts.cityCode,
    after: opts.after ? new Date(opts.after) : undefined,
    limit: opts.limit,
  });
