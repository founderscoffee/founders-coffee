import { sql } from 'drizzle-orm';

import { id } from '@founders-coffee/core';

import type { Db } from './db.js';
import { createRsvp } from './rsvps.js';
import { seedEvent } from './rsvps.fixtures.js';
import {
  completeTelegramConnect,
  openTelegramConnect,
} from './telegram-groups.js';
import { saveTelegramInvite } from './telegram-invites.js';

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

let chatCounter = 0;
let linkCounter = 0;

/** Chats and Telegram accounts no other test in the file has used, since D1 is shared across them. */
export const telegramIds = (): {
  CHAT: number;
  OTHER_CHAT: number;
  ACCOUNT: number;
  OTHER_ACCOUNT: number;
} => {
  chatCounter += 2;
  const chat = -1001000000000 - chatCounter;
  const account = 7000000000 + chatCounter;
  return {
    CHAT: chat,
    OTHER_CHAT: chat - 1,
    ACCOUNT: account,
    OTHER_ACCOUNT: account + 1,
  };
};

export const nextLink = (): string => `https://t.me/+invite${++linkCounter}`;

/** Give a member an invite to a meetup, and answer its link. */
export const inviteTo = async (
  db: Db,
  eventId: string,
  userId: string,
): Promise<string> => {
  const inviteLink = nextLink();
  await saveTelegramInvite(db, {
    id: `tgi_${linkCounter}`,
    eventId,
    userId,
    inviteLink,
    now: new Date(),
  });
  return inviteLink;
};

/** A published meetup live on `chatId`, with `userId` going and holding an invite. */
export const liveMeetupFor = async (
  db: Db,
  chatId: number,
  userId: string,
): Promise<{ eventId: string; inviteLink: string }> => {
  const eventId = await seedEvent(db);
  await connectGroup(db, eventId, chatId);
  await attend(db, eventId, userId);
  return { eventId, inviteLink: await inviteTo(db, eventId, userId) };
};
