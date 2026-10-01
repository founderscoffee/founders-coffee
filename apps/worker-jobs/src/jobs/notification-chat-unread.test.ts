import { beforeEach, describe, expect, it } from 'vitest';

import {
  CHAT_UNREAD_TITLE_SLOT,
  cancelRsvp,
  chatMembers,
  createRsvp,
  eq,
  markChatRead,
  scheduledNotifications,
  sendChatMessage,
  setChatMuted,
  type ChatUnreadNotice,
  type Db,
} from '@founders-coffee/db';

import { sweepNotifications } from './notification-sweep.js';
import {
  EVENT_ID,
  HOST_ID,
  MEMBER_ID,
  addPushToken,
  countingPush,
  providers,
  rowById,
  setPreferences,
  setupDb,
} from './notification-sweep.fixtures.js';

const NOW = new Date('2026-09-02T10:00:00Z');

const NOTICE: ChatUnreadNotice = {
  sendAt: new Date('2020-01-01T00:00:00Z'),
  baseUrl: 'https://founders.test',
  content: {
    ar: { title: `رسائل جديدة في ${CHAT_UNREAD_TITLE_SLOT}`, body: 'افتح.' },
    en: { title: `New messages in ${CHAT_UNREAD_TITLE_SLOT}`, body: 'Open.' },
    fr: {
      title: `Nouveaux messages ${CHAT_UNREAD_TITLE_SLOT}`,
      body: 'Ouvrez.',
    },
  },
};

/** The host writes in the meetup's chat, which queues the member's push; the row's id comes back. */
const hostWrites = async (db: Db): Promise<string> => {
  const sent = await sendChatMessage(db, {
    eventId: EVENT_ID,
    authorId: HOST_ID,
    body: 'Salam',
    clientId: crypto.randomUUID(),
    unread: NOTICE,
  });
  expect(sent).toMatchObject({ outcome: 'sent', noticesQueued: 1 });
  const [row] = await db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.templateKey, 'chat_unread'));
  if (!row) throw new Error('the member’s chat_unread was not queued');
  return row.id;
};

const sweep = async (db: Db) => {
  const push = countingPush();
  await sweepNotifications(db, providers({ push: push.provider }), NOW);
  return push.sends;
};

describe('a meetup chat’s unread push, decided when it comes due (CH-07)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
    await createRsvp(db, {
      id: 'rsv_sweepchat',
      eventId: EVENT_ID,
      userId: MEMBER_ID,
    });
    await db.delete(chatMembers).where(eq(chatMembers.userId, MEMBER_ID));
    await setPreferences(db, { meetupChat: true });
    await addPushToken(db, 'device-1');
  });

  it('reaches a member who has not read it, collapsed into one notification per chat', async () => {
    const rowId = await hostWrites(db);

    const sends = await sweep(db);

    expect(sends).toEqual([
      { token: 'device-1', dedupeKey: `chat_${EVENT_ID}` },
    ]);
    const row = await rowById(db, rowId);
    expect(row?.status).toBe('sent');
    expect(row?.payload).toMatchObject({
      locale: 'ar',
      pushTitle: 'رسائل جديدة في Sweep fixture',
      pushUrl:
        'https://founders.test/ar/algeria/e/sweep-fixture-event?chat=true',
    });
  });

  it('drops it for a member who read the chat in the meantime', async () => {
    const rowId = await hostWrites(db);
    await markChatRead(db, {
      eventId: EVENT_ID,
      userId: MEMBER_ID,
      at: Date.now(),
    });

    expect(await sweep(db)).toEqual([]);
    expect(await rowById(db, rowId)).toMatchObject({
      status: 'failed',
      lastError: 'unreachable: chat_read',
    });
  });

  it('drops it for a member who muted the chat in the meantime', async () => {
    const rowId = await hostWrites(db);
    await setChatMuted(db, {
      eventId: EVENT_ID,
      userId: MEMBER_ID,
      muted: true,
    });

    expect(await sweep(db)).toEqual([]);
    expect(await rowById(db, rowId)).toMatchObject({
      status: 'failed',
      lastError: 'unreachable: chat_muted',
    });
  });

  it('drops it for a member who switched the chat’s notifications off in the meantime', async () => {
    const rowId = await hostWrites(db);
    await setPreferences(db, { meetupChat: false });

    expect(await sweep(db)).toEqual([]);
    expect(await rowById(db, rowId)).toMatchObject({
      status: 'failed',
      lastError: 'unreachable: meetup_chat_off',
    });
  });

  it('drops it for a member who is no longer going', async () => {
    const rowId = await hostWrites(db);
    await cancelRsvp(db, { eventId: EVENT_ID, userId: MEMBER_ID });

    expect(await sweep(db)).toEqual([]);
    expect(await rowById(db, rowId)).toMatchObject({
      status: 'failed',
      lastError: 'unreachable: chat_not_member',
    });
  });
});
