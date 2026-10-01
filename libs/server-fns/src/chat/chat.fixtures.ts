import { env } from 'cloudflare:workers';

import { id } from '@founders-coffee/core';
import {
  createDb,
  createEventIfRouteAvailable,
  createRsvp,
  eq,
  seed,
  sql,
  syncChatChannel,
  user,
  type Db,
  type NewEvent,
  type NewUser,
} from '@founders-coffee/db';

export const HOST_ID = 'usr_chathost';

let counter = 0;

/** A database with the launch markets, the chat switched on in them, and the meetups' host. */
export const setupDb = async (db: Db = createDb(env.DB)): Promise<Db> => {
  await seed(db);
  await db
    .insert(user)
    .values({
      id: HOST_ID,
      name: 'Chat Host',
      email: 'host@chat.test',
      emailVerified: false,
      role: 'host',
    })
    .onConflictDoNothing()
    .run();
  return db;
};

/** A meetup published in Algiers the way a host publishes one, with its chat. */
export const publishMeetup = async (
  db: Db,
  overrides: Partial<NewEvent> = {},
): Promise<string> => {
  const n = ++counter;
  const eventId = id('evt');
  const created = await createEventIfRouteAvailable(db, {
    id: eventId,
    slug: `chat-server-${n}`,
    hostId: HOST_ID,
    marketCode: 'DZ',
    stateCode: '16',
    cityCode: '1',
    title: `Chat server ${n}`,
    description: 'Chat server behaviour fixture.',
    venue: 'Café des Délices, Hydra',
    startsAt: new Date('2099-01-15T18:00:00Z'),
    endsAt: new Date('2099-01-15T20:00:00Z'),
    language: 'fr',
    status: 'published',
    ...overrides,
  });
  if (!created) throw new Error(`chat fixture ${n} was not published`);
  return eventId;
};

/** A member no other test in the file has touched, since D1 is shared across them. */
export const newMember = async (
  db: Db,
  overrides: Partial<NewUser> = {},
): Promise<string> => {
  const userId = `usr_chat_server_${++counter}`;
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

/** A new member going to the meetup, through the ordinary guarded RSVP write. */
export const goingMember = async (
  db: Db,
  eventId: string,
  overrides: Partial<NewUser> = {},
): Promise<string> => {
  const userId = await newMember(db, overrides);
  await createRsvp(db, { id: id('rsv'), eventId, userId });
  return userId;
};

/** Switch the meetup chat on or off in a market, as a migration sets its flag. */
export const switchChat = async (
  db: Db,
  marketCode: string,
  isOn: boolean,
): Promise<void> => {
  await db.run(
    sql`UPDATE markets SET feature_flags = json_set(feature_flags, '$.meetupChat', json(${isOn ? 'true' : 'false'})) WHERE code = ${marketCode}`,
  );
};

/** Ban a member's account the way moderation leaves it. */
export const ban = async (db: Db, userId: string): Promise<void> => {
  await db.update(user).set({ banned: true }).where(eq(user.id, userId)).run();
};

/** Put the meetup's end `secondsAgo` in the past by the database's clock, with its chat in line. */
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
