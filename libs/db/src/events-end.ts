import { sql, type SQL } from 'drizzle-orm';

import { events } from './schema.js';

export const ASSUMED_DURATION_SECONDS = 2 * 60 * 60;

/**
 * When the meetup in the statement's `events` row ends, in epoch seconds: its own end, or
 * {@link ASSUMED_DURATION_SECONDS} after its start when it names none, as meetups published before
 * an end was asked for do.
 */
export const eventEndsAt = (): SQL =>
  sql`coalesce(${events.endsAt}, ${events.startsAt} + ${ASSUMED_DURATION_SECONDS})`;
