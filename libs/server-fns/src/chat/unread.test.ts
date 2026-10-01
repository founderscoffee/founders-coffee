import { beforeEach, describe, expect, it } from 'vitest';

import {
  accountPreferences,
  and,
  CHAT_UNREAD_TITLE_SLOT,
  eq,
  scheduledNotifications,
  type Db,
} from '@founders-coffee/db';
import { notifications } from '@founders-coffee/domain';

import { notificationBaseUrl } from '../notifications/context.js';
import {
  goingMember,
  HOST_ID,
  newMember,
  publishMeetup,
  setupDb,
} from './chat.fixtures.js';
import { sendChatMessageResolver } from './messages.js';
import {
  CHAT_UNREAD_DELAY_MS,
  chatUnreadNotice,
  readChatUnreadCountsResolver,
} from './unread.js';

const withPush = (db: Db, userId: string) =>
  db
    .insert(accountPreferences)
    .values({ userId, pushEnabled: true })
    .onConflictDoUpdate({
      target: accountPreferences.userId,
      set: { pushEnabled: true },
    });

const noticesIn = (db: Db, eventId: string) =>
  db
    .select()
    .from(scheduledNotifications)
    .where(
      and(
        eq(scheduledNotifications.eventId, eventId),
        eq(scheduledNotifications.templateKey, 'chat_unread'),
      ),
    );

describe('what a chat message tells the members who are not reading (real D1 via Miniflare)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('words the push in every language, with the title left to the database, two minutes out', () => {
    const now = new Date('2026-09-30T18:00:00Z');

    const notice = chatUnreadNotice(now);

    expect(notice.sendAt).toEqual(
      new Date(now.getTime() + CHAT_UNREAD_DELAY_MS),
    );
    expect(notice.baseUrl).toBe(notificationBaseUrl());
    expect(notice.content).toEqual({
      ar: {
        title: `رسائل جديدة في «${CHAT_UNREAD_TITLE_SLOT}»`,
        body: 'افتح المحادثة لقراءتها.',
      },
      en: {
        title: `New messages in ${CHAT_UNREAD_TITLE_SLOT}`,
        body: 'Open the chat to read them.',
      },
      fr: {
        title: `Nouveaux messages dans « ${CHAT_UNREAD_TITLE_SLOT} »`,
        body: 'Ouvrez la discussion pour les lire.',
      },
    });
  });

  it('queues a push for each other member, in their language, that the dispatcher can read', async () => {
    const eventId = await publishMeetup(db, { title: 'Founders & coffee' });
    const author = await goingMember(db, eventId);
    const reader = await goingMember(db, eventId, { localePref: 'fr' });
    await Promise.all([author, reader, HOST_ID].map((id) => withPush(db, id)));
    const before = Date.now();

    const sent = await sendChatMessageResolver(db, {
      eventId,
      authorId: author,
      body: 'Salam',
      clientId: crypto.randomUUID(),
    });

    expect(sent.ok).toBe(true);
    const notices = await noticesIn(db, eventId);
    expect(notices.map((notice) => notice.userId).sort()).toEqual(
      [HOST_ID, reader].sort(),
    );
    const toReader = notices.find((notice) => notice.userId === reader);
    const parsed = notifications.parseNotificationPayload(
      'push',
      toReader?.payload,
    );
    expect(parsed.ok && parsed.value.payload).toMatchObject({
      locale: 'fr',
      pushTitle: 'Nouveaux messages dans « Founders & coffee »',
      pushBody: 'Ouvrez la discussion pour les lire.',
      pushUrl: expect.stringMatching(
        new RegExp(
          `^${notificationBaseUrl()}/fr/algeria/e/chat-server-\\d+\\?chat=true$`,
        ),
      ),
    });
    const due = toReader?.sendAt.getTime() ?? 0;
    expect(due).toBeGreaterThanOrEqual(
      Math.floor((before + CHAT_UNREAD_DELAY_MS) / 1000) * 1000,
    );
    expect(due).toBeLessThanOrEqual(Date.now() + CHAT_UNREAD_DELAY_MS);
  });

  it('queues nothing more for the retry of a message already sent', async () => {
    const eventId = await publishMeetup(db);
    const author = await goingMember(db, eventId);
    await withPush(db, HOST_ID);
    const input = {
      eventId,
      authorId: author,
      body: 'Salam',
      clientId: crypto.randomUUID(),
    };

    await sendChatMessageResolver(db, input);
    await db
      .update(scheduledNotifications)
      .set({ status: 'sent' })
      .where(eq(scheduledNotifications.eventId, eventId));
    await sendChatMessageResolver(db, input);

    expect(await noticesIn(db, eventId)).toHaveLength(1);
  });

  it('counts a member’s unread messages in their own chats alone', async () => {
    const eventId = await publishMeetup(db);
    const elsewhere = await publishMeetup(db);
    const member = await goingMember(db, eventId);
    const stranger = await newMember(db);
    for (const chat of [eventId, elsewhere])
      await sendChatMessageResolver(db, {
        eventId: chat,
        authorId: HOST_ID,
        body: 'Salam',
        clientId: crypto.randomUUID(),
      });

    const counts = await readChatUnreadCountsResolver(db, {
      userId: member,
      eventIds: [eventId, elsewhere],
    });
    const strangers = await readChatUnreadCountsResolver(db, {
      userId: stranger,
      eventIds: [eventId, elsewhere],
    });

    expect(counts).toEqual({ ok: true, data: [{ eventId, unread: 1 }] });
    expect(strangers).toEqual({ ok: true, data: [] });
  });
});
