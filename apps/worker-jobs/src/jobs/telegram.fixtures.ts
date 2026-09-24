import { env } from 'cloudflare:workers';

import { id, type TelegramTemplateKey } from '@founders-coffee/core';
import {
  completeTelegramConnect,
  createDb,
  createEvent,
  enqueueNotification,
  getNotification,
  openTelegramConnect,
  seed,
  user,
  type Db,
} from '@founders-coffee/db';
import type {
  DevTelegramProvider,
  TelegramFailure,
} from '@founders-coffee/notifications';

import { sweepNotifications } from './notification-sweep.js';
import { providers } from './notification-sweep.fixtures.js';

export const HOST_ID = 'usr_tgdispatchhost';
export const MEMBER_ID = 'usr_tgdispatchmember';
export const SECOND = 1000;

let counter = 0;

export const setupDb = async (): Promise<Db> => {
  const db = createDb(env.DB);
  await seed(db);
  await db
    .insert(user)
    .values([
      {
        id: HOST_ID,
        name: 'Dispatch Host',
        email: 'host@tgdispatch.test',
        emailVerified: false,
        role: 'host',
      },
      {
        id: MEMBER_ID,
        name: 'Dispatch Member',
        email: 'member@tgdispatch.test',
        emailVerified: false,
        role: 'member',
      },
    ])
    .onConflictDoNothing()
    .run();
  return db;
};

/** A chat id no other test in the file has used, since D1 is shared across a file's tests. */
export const nextChatId = (): number => -1004000000000 - ++counter;

/** A published meetup whose group is live on `chatId`, a fresh chat unless told. */
export const liveGroup = async (
  db: Db,
  chatId: number = nextChatId(),
): Promise<{ eventId: string; chatId: number }> => {
  const n = ++counter;
  const eventId = id('evt');
  await createEvent(db, {
    id: eventId,
    slug: `telegram-dispatch-${n}`,
    hostId: HOST_ID,
    marketCode: 'DZ',
    stateCode: '16',
    cityCode: '556',
    title: `Coffee and code ${n}`,
    description: 'Telegram dispatch fixture.',
    venue: 'Café des Délices',
    startsAt: new Date('2099-01-15T18:00:00Z'),
    endsAt: new Date('2099-01-15T20:00:00Z'),
    language: 'en',
    status: 'published',
  });
  const now = new Date();
  const tokenHash = `dispatch_${eventId}`;
  await openTelegramConnect(db, {
    eventId,
    tokenHash,
    expiresAt: new Date(now.getTime() + 3600 * SECOND),
    now,
  });
  await completeTelegramConnect(db, {
    eventId,
    tokenHash,
    chatId,
    chatTitle: 'Coffee group',
    now,
  });
  return { eventId, chatId };
};

/** Queue one of the bot's jobs for a meetup, due now unless told, with the producers' payload. */
export const queue = async (
  db: Db,
  eventId: string,
  templateKey: TelegramTemplateKey,
  content: Record<string, unknown> = {},
  sendAt: Date = new Date(Date.now() - SECOND),
): Promise<string> => {
  const row = await enqueueNotification(db, {
    id: id('ntf'),
    eventId,
    userId: templateKey === 'telegram_member_removed' ? MEMBER_ID : HOST_ID,
    channel: 'telegram',
    templateKey,
    payload: {
      eventTitle: 'Coffee and code',
      eventSlug: 'coffee-and-code',
      marketCode: 'DZ',
      startsAt: '2099-01-15T18:00:00.000Z',
      venue: 'Café des Délices',
      locale: 'en',
      ...content,
    },
    sendAt,
  });
  return row.id;
};

/** Run a meetup's due rows through the real sweep, with the recording bot, at `now`. */
export const run = (
  db: Db,
  eventId: string,
  telegram: DevTelegramProvider,
  now: Date = new Date(),
) => sweepNotifications(db, providers({ telegram }), now, { eventId });

export const rowOf = async (db: Db, notificationId: string) =>
  getNotification(db, notificationId);

export const refusal = (
  kind: 'chat_gone' | 'message_missing' | 'rejected' | 'unavailable',
): TelegramFailure => ({ kind, message: `dev ${kind}` });

export const rateLimited: TelegramFailure = {
  kind: 'rate_limited',
  retryAfterSeconds: 5,
  message: 'Too Many Requests: retry after 5',
};
