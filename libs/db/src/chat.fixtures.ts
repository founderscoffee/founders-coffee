import { eq, sql } from 'drizzle-orm';

import { id } from '@founders-coffee/core';

import { syncChatChannel } from './chat-channels.js';
import type { Db } from './db.js';
import { createEventIfRouteAvailable } from './events.js';
import { createRsvp } from './rsvps.js';
import { HOST_ID } from './rsvps.fixtures.js';
import { chatMessages, user, type NewEvent, type NewUser } from './schema.js';

export const DAY_SECONDS = 24 * 60 * 60;

let counter = 0;

/** A meetup's row, by `HOST_ID` in Algiers unless told, with an address no other test has used. */
export const meetupRow = (overrides: Partial<NewEvent> = {}): NewEvent => {
  const n = ++counter;
  return {
    id: id('evt'),
    slug: `chat-fixture-${n}`,
    hostId: HOST_ID,
    marketCode: 'DZ',
    stateCode: '16',
    cityCode: '1',
    title: `Chat fixture ${n}`,
    description: 'Chat behaviour fixture.',
    venue: 'Café des Délices, Hydra',
    startsAt: new Date('2099-01-15T18:00:00Z'),
    endsAt: new Date('2099-01-15T20:00:00Z'),
    language: 'fr',
    status: 'published',
    ...overrides,
  };
};

/** A meetup published the way a host publishes one, with its chat. */
export const publishMeetup = async (
  db: Db,
  overrides: Partial<NewEvent> = {},
): Promise<string> => {
  const row = meetupRow(overrides);
  const created = await createEventIfRouteAvailable(db, row);
  if (!created) throw new Error(`chat fixture ${row.slug} was not published`);
  return row.id;
};

/** A new member no other test in the file has touched, since D1 is shared across them. */
export const newMember = async (
  db: Db,
  overrides: Partial<NewUser> = {},
): Promise<string> => {
  const userId = `usr_chat_${++counter}`;
  await db
    .insert(user)
    .values({
      id: userId,
      name: `Chat member ${counter}`,
      email: `${userId}@chat.test`,
      emailVerified: false,
      role: 'member',
      ...overrides,
    })
    .run();
  return userId;
};

/** Make `userId` going on the meetup through the ordinary guarded RSVP write. */
export const going = async (
  db: Db,
  eventId: string,
  userId: string,
): Promise<void> => {
  await createRsvp(db, { id: id('rsv'), eventId, userId });
};

/**
 * Put the meetup's end `secondsAgo` in the past by the database's own clock, and bring its chat in
 * line the way the meetup's own writes do.
 */
export const endMeetupAgo = async (
  db: Db,
  eventId: string,
  secondsAgo: number,
): Promise<void> => {
  await db.run(
    sql`UPDATE events SET starts_at = unixepoch() - ${secondsAgo} - 7200, ends_at = unixepoch() - ${secondsAgo} WHERE id = ${eventId}`,
  );
  await syncChatChannel(db, eventId);
};

/** Write a message straight into a chat, at a chosen time, for the tests that page through one. */
export const writeMessage = async (
  db: Db,
  input: {
    channelId: string;
    authorId: string | null;
    createdAt: number;
    id?: string;
    kind?: 'text' | 'system';
    body?: string;
  },
): Promise<string> => {
  const messageId = input.id ?? id('msg');
  await db
    .insert(chatMessages)
    .values({
      id: messageId,
      channelId: input.channelId,
      authorId: input.authorId,
      kind: input.kind ?? 'text',
      body: input.body ?? `message ${messageId}`,
      systemKey: input.kind === 'system' ? 'rescheduled' : null,
      clientId: input.authorId === null ? null : id('cli'),
      createdAt: new Date(input.createdAt),
    })
    .run();
  return messageId;
};

/** Set an account's state or ban the way moderation and account closure leave it. */
export const setAccount = async (
  db: Db,
  userId: string,
  change: Partial<Pick<NewUser, 'accountState' | 'banned'>>,
): Promise<void> => {
  await db.update(user).set(change).where(eq(user.id, userId)).run();
};

/** The database's clock, in epoch seconds. */
export const dbNowSeconds = async (db: Db): Promise<number> => {
  const [row] = await db.all<{ now: number }>(sql`SELECT unixepoch() AS now`);
  return row?.now ?? 0;
};
