import { sql } from 'drizzle-orm';

import { id } from '@founders-coffee/core';

import type { Db } from './db.js';
import { createRsvp } from './rsvps.js';
import {
  completeTelegramConnect,
  openTelegramConnect,
} from './telegram-groups.js';

export const HOUR_MS = 60 * 60 * 1000;

/** Connect a meetup to a chat the way the webhook does, and answer whether it connected. */
export const connectGroup = async (
  db: Db,
  eventId: string,
  chatId: number,
  now: Date = new Date(),
): Promise<boolean> => {
  const tokenHash = `hash_${eventId}_${chatId}_${now.getTime()}`;
  await openTelegramConnect(db, {
    eventId,
    tokenHash,
    expiresAt: new Date(now.getTime() + HOUR_MS),
    now,
  });
  return completeTelegramConnect(db, {
    eventId,
    tokenHash,
    chatId,
    chatTitle: 'Coffee group',
    now,
  });
};

/** Make a member going on a meetup through the ordinary guarded RSVP write. */
export const attend = async (
  db: Db,
  eventId: string,
  userId: string,
): Promise<void> => {
  await createRsvp(db, { id: id('rsvp'), eventId, userId });
};

/** Put a meetup's end in the past, relative to the database's own clock. */
export const endMeetup = async (db: Db, eventId: string): Promise<void> => {
  await db.run(
    sql`UPDATE events SET starts_at = unixepoch() - 7200, ends_at = unixepoch() - 60 WHERE id = ${eventId}`,
  );
};
