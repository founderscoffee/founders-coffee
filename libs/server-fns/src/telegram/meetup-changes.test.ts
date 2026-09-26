import { beforeEach, describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import {
  admitTelegramMember,
  getTelegramInvite,
  saveTelegramInvite,
  type Db,
  type Event,
} from '@founders-coffee/db';
import { eventUpdateSchema } from '@founders-coffee/domain';

import { cancelEventResolver } from '../events/cancel.js';
import { testMapProvider } from '../events/resolver.fixtures.js';
import { updateEventResolver } from '../events/update.js';
import { cancelRsvpResolver } from '../rsvps/resolver.js';
import { scheduleTelegramGroup } from './notices.js';
import {
  attend,
  connectMeetup,
  HOST_ID,
  MEMBER_IDS,
  payloadOf,
  pendingKeys,
  seedMeetup,
  setupDb,
  telegramRows,
} from './telegram.fixtures.js';

const ACCOUNT = 7400000001;

describe('what a Telegram group hears as its meetup changes (real D1 via Miniflare)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  const connected = async (): Promise<{ event: Event; chatId: number }> => {
    const event = await seedMeetup(db);
    const chatId = await connectMeetup(db, event);
    await scheduleTelegramGroup(db, event);
    return { event, chatId };
  };

  const edit = (event: Event, changes: Record<string, unknown>) =>
    updateEventResolver(db, testMapProvider, {
      eventId: event.id,
      actorId: HOST_ID,
      input: eventUpdateSchema.parse({
        expectedVersion: event.version,
        title: event.title,
        description: event.description,
        venueName: event.venue,
        startsAt: event.startsAt.getTime(),
        endsAt: event.endsAt?.getTime(),
        language: event.language,
        ...changes,
      }),
    });

  const joined = async (event: Event, chatId: number, userId: string) => {
    await attend(db, event.id, userId);
    const inviteLink = `https://t.me/+${id('lnk')}`;
    await saveTelegramInvite(db, {
      id: id('tgi'),
      eventId: event.id,
      userId,
      inviteLink,
      now: new Date(),
    });
    await admitTelegramMember(db, {
      inviteLink,
      chatId,
      telegramUserId: ACCOUNT,
      now: new Date(),
    });
    return inviteLink;
  };

  it('posts a new time to the group when the host moves the meetup', async () => {
    const { event } = await connected();

    const result = await edit(event, {
      startsAt: new Date('2099-01-16T18:00:00Z').getTime(),
      endsAt: new Date('2099-01-16T20:00:00Z').getTime(),
    });

    expect(result.ok).toBe(true);
    expect(await pendingKeys(db, event.id)).toEqual([
      'telegram_details',
      'telegram_rescheduled',
      'telegram_reminder',
      'telegram_wrap_up',
    ]);
  });

  it('rewrites the pinned details for an edit no member is told about', async () => {
    const { event } = await connected();
    const before = new Set(
      (await telegramRows(db, event.id)).map((row) => row.id),
    );

    await edit(event, { title: 'Coffee, code and croissants' });

    const added = (await telegramRows(db, event.id)).filter(
      (row) => !before.has(row.id),
    );
    expect(added.map((row) => row.templateKey).sort()).toEqual([
      'telegram_details',
      'telegram_reminder',
      'telegram_wrap_up',
    ]);
    expect(
      payloadOf(added.find((row) => row.templateKey === 'telegram_details'))
        .telegramPinnedText,
    ).toContain('Coffee, code and croissants');
  });

  it('tells the group the meetup is off, and still takes out a member who left just before', async () => {
    const { event, chatId } = await connected();
    await joined(event, chatId, MEMBER_IDS[0]);
    await cancelRsvpResolver(db, { eventId: event.id, userId: MEMBER_IDS[0] });

    const result = await cancelEventResolver(db, {
      eventId: event.id,
      actorId: HOST_ID,
      reason: 'The café is closed for repairs',
    });

    expect(result.ok).toBe(true);
    expect(await pendingKeys(db, event.id)).toEqual([
      'telegram_member_removed',
      'telegram_cancelled',
    ]);
    const cancelled = (await telegramRows(db, event.id)).find(
      (row) =>
        row.templateKey === 'telegram_cancelled' && row.status === 'pending',
    );
    expect(payloadOf(cancelled).telegramText).toContain(
      'The café is closed for repairs',
    );
  });

  it('takes a member who cancels out of the group, and their link with them', async () => {
    const { event, chatId } = await connected();
    const inviteLink = await joined(event, chatId, MEMBER_IDS[1]);

    const result = await cancelRsvpResolver(db, {
      eventId: event.id,
      userId: MEMBER_IDS[1],
    });

    expect(result.ok).toBe(true);
    expect(
      await getTelegramInvite(db, { eventId: event.id, userId: MEMBER_IDS[1] }),
    ).toBeUndefined();
    const removal = (await telegramRows(db, event.id)).find(
      (row) => row.templateKey === 'telegram_member_removed',
    );
    expect(removal).toMatchObject({ status: 'pending', userId: MEMBER_IDS[1] });
    expect(payloadOf(removal)).toMatchObject({
      telegramChatId: chatId,
      telegramUserId: ACCOUNT,
      telegramInviteLink: inviteLink,
    });
  });
});
