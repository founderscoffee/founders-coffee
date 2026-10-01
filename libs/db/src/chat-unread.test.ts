import { and, eq, sql } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import { markChatRead, setChatMuted } from './chat-members.js';
import { sendChatMessage } from './chat-messages.js';
import {
  going,
  newMember,
  publishMeetup,
  setAccount,
  unreadNotice,
} from './chat.fixtures.js';
import type { Db } from './index.js';
import { cancelRsvp } from './rsvps.js';
import { HOST_ID, setupDb } from './rsvps.fixtures.js';
import { accountPreferences, scheduledNotifications } from './schema.js';

const SEND_AT = new Date('2099-01-15T18:02:00.000Z');

const withPush = async (
  db: Db,
  userId: string,
  changes: { pushEnabled?: boolean; meetupChatChannels?: number } = {},
) => {
  const values = {
    pushEnabled: changes.pushEnabled ?? true,
    meetupChatChannels: changes.meetupChatChannels ?? 1,
    meetupChat: (changes.meetupChatChannels ?? 1) !== 0,
  };
  await db
    .insert(accountPreferences)
    .values({ userId, ...values })
    .onConflictDoUpdate({ target: accountPreferences.userId, set: values });
};

const send = (
  db: Db,
  eventId: string,
  authorId: string,
  clientId: string = crypto.randomUUID(),
) =>
  sendChatMessage(db, {
    eventId,
    authorId,
    body: 'Salam',
    clientId,
    unread: unreadNotice(SEND_AT),
  });

const noticesFor = (db: Db, eventId: string, userId?: string) =>
  db
    .select()
    .from(scheduledNotifications)
    .where(
      and(
        eq(scheduledNotifications.eventId, eventId),
        eq(scheduledNotifications.templateKey, 'chat_unread'),
        userId ? eq(scheduledNotifications.userId, userId) : sql`1`,
      ),
    );

/** Take a member's pending notice as delivered, as the dispatcher leaves it. */
const deliver = (db: Db, eventId: string) =>
  db
    .update(scheduledNotifications)
    .set({ status: 'sent' })
    .where(eq(scheduledNotifications.eventId, eventId));

describe('queueChatUnread, in the batch of a send (real D1)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('queues a push for each other member, in their language, linking to the chat', async () => {
    const eventId = await publishMeetup(db, { title: 'Café & code' });
    const author = await newMember(db);
    const french = await newMember(db, { localePref: 'fr' });
    await going(db, eventId, author);
    await going(db, eventId, french);
    await Promise.all([author, french, HOST_ID].map((id) => withPush(db, id)));

    const sent = await send(db, eventId, author);

    expect(sent).toMatchObject({ outcome: 'sent', noticesQueued: 2 });
    const notices = await noticesFor(db, eventId);
    expect(notices.map((notice) => notice.userId).sort()).toEqual(
      [HOST_ID, french].sort(),
    );
    const toFrench = notices.find((notice) => notice.userId === french);
    const toHost = notices.find((notice) => notice.userId === HOST_ID);
    expect(toFrench).toMatchObject({
      id: expect.stringMatching(/^ntf_[0-9a-f]{32}$/),
      channel: 'push',
      status: 'pending',
      sendAt: SEND_AT,
      attempts: 0,
      fallbackChannel: null,
    });
    const slug = (toFrench?.payload as { eventSlug: string }).eventSlug;
    expect(toFrench?.payload).toEqual({
      eventTitle: 'Café & code',
      eventSlug: slug,
      marketCode: 'DZ',
      startsAt: '2099-01-15T18:00:00.000Z',
      venue: 'Café des Délices, Hydra',
      locale: 'fr',
      pushTitle: 'Nouveaux messages dans Café & code',
      pushBody: 'Ouvrez la discussion pour les lire.',
      pushUrl: `https://founders.test/fr/algeria/e/${slug}?chat=true`,
    });
    expect(toHost?.payload).toMatchObject({
      locale: 'ar',
      pushTitle: 'رسائل جديدة في Café & code',
      pushUrl: `https://founders.test/ar/algeria/e/${slug}?chat=true`,
    });
  });

  it('queues nothing again for a retry the chat already holds', async () => {
    const eventId = await publishMeetup(db);
    const author = await newMember(db);
    await going(db, eventId, author);
    await withPush(db, HOST_ID);
    const clientId = crypto.randomUUID();

    await send(db, eventId, author, clientId);
    await deliver(db, eventId);
    const retry = await send(db, eventId, author, clientId);

    expect(retry).toMatchObject({ outcome: 'already_sent', noticesQueued: 0 });
    expect(await noticesFor(db, eventId)).toHaveLength(1);
  });

  it('tells a member once per unread stretch, and again once they have read', async () => {
    const eventId = await publishMeetup(db);
    const author = await newMember(db);
    const reader = await newMember(db);
    await going(db, eventId, author);
    await going(db, eventId, reader);
    await withPush(db, reader);

    await send(db, eventId, author);
    await send(db, eventId, author);
    await deliver(db, eventId);
    const afterPush = await send(db, eventId, author);
    expect(afterPush).toMatchObject({ noticesQueued: 0 });
    expect(await noticesFor(db, eventId, reader)).toHaveLength(1);

    await markChatRead(db, { eventId, userId: reader, at: Date.now() });
    const afterRead = await send(db, eventId, author);

    expect(afterRead).toMatchObject({ noticesQueued: 1 });
    expect(await noticesFor(db, eventId, reader)).toHaveLength(2);
  });

  it('leaves out a member who muted the chat, switched its push off, has no push, left or was banned', async () => {
    const eventId = await publishMeetup(db);
    const author = await newMember(db);
    const [muted, switchedOff, noPush, left, banned] = await Promise.all([
      newMember(db),
      newMember(db),
      newMember(db),
      newMember(db),
      newMember(db),
    ]);
    for (const member of [author, muted, switchedOff, noPush, left, banned])
      await going(db, eventId, member);
    await withPush(db, muted);
    await setChatMuted(db, { eventId, userId: muted, muted: true });
    await withPush(db, switchedOff, { meetupChatChannels: 0 });
    await withPush(db, noPush, { pushEnabled: false });
    await withPush(db, left);
    await cancelRsvp(db, { eventId, userId: left });
    await withPush(db, banned);
    await setAccount(db, banned, { banned: true });
    await withPush(db, HOST_ID, { pushEnabled: false });

    const sent = await send(db, eventId, author);

    expect(sent).toMatchObject({ outcome: 'sent', noticesQueued: 0 });
    expect(await noticesFor(db, eventId)).toEqual([]);
  });
});
