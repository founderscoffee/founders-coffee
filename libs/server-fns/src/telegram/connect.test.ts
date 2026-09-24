import { beforeEach, describe, expect, it } from 'vitest';

import { getTelegramGroup, type Db } from '@founders-coffee/db';
import {
  DEV_TELEGRAM_BOT_ID,
  type TelegramChatMember,
} from '@founders-coffee/notifications';

import { connectFromStart, startToken } from './connect.js';
import {
  ADMIN_ID,
  BOT_USERNAME,
  devSetup,
  groupMessage,
  nextChatId,
  openConnect,
  pendingKeys,
  seedMeetup,
  setupDb,
} from './telegram.fixtures.js';

const member = (
  status: TelegramChatMember['status'],
  rights = true,
): TelegramChatMember => ({
  status,
  canInviteUsers: rights,
  canRestrictMembers: rights,
  canPinMessages: rights,
});

describe('connecting a Telegram group to a meetup (real D1 via Miniflare)', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('reads the token from a /start addressed to this bot and to no other', () => {
    const token = 'A'.repeat(32);

    expect(startToken(`/start@${BOT_USERNAME} ${token}`, BOT_USERNAME)).toBe(
      token,
    );
    expect(startToken(`/start@foundersCOFFEEbot ${token}`, BOT_USERNAME)).toBe(
      token,
    );
    expect(startToken(`/start ${token}`, BOT_USERNAME)).toBe(token);
    expect(startToken(`/start@OtherBot ${token}`, BOT_USERNAME)).toBeNull();
    expect(startToken('/start', BOT_USERNAME)).toBeNull();
    expect(startToken(`see /start ${token}`, BOT_USERNAME)).toBeNull();
    expect(startToken(undefined, BOT_USERNAME)).toBeNull();
  });

  it('connects the group an admin posted the token in, and pins its details', async () => {
    const event = await seedMeetup(db);
    const token = await openConnect(db, event);
    const chatId = nextChatId();
    const setup = devSetup();

    await connectFromStart(
      db,
      setup,
      groupMessage(chatId, `/start@${BOT_USERNAME} ${token}`),
      token,
      new Date(),
    );

    expect(await getTelegramGroup(db, event.id)).toMatchObject({
      status: 'active',
      chatId,
      chatTitle: 'Coffee group',
    });
    expect(await pendingKeys(db, event.id)).toEqual([
      'telegram_details',
      'telegram_reminder',
      'telegram_wrap_up',
    ]);
    expect(setup.provider.callsTo('sendMessage')).toEqual([]);
  });

  it('lets the creator of the group connect it', async () => {
    const event = await seedMeetup(db);
    const token = await openConnect(db, event);
    const setup = devSetup(new Map([[ADMIN_ID, member('creator')]]));

    await connectFromStart(
      db,
      setup,
      groupMessage(nextChatId(), `/start ${token}`),
      token,
      new Date(),
    );

    expect((await getTelegramGroup(db, event.id))?.status).toBe('active');
  });

  it('takes an admin posting as the group itself for an admin', async () => {
    const event = await seedMeetup(db);
    const token = await openConnect(db, event);
    const chatId = nextChatId();
    const setup = devSetup(new Map([[ADMIN_ID, member('member')]]));

    await connectFromStart(
      db,
      setup,
      {
        ...groupMessage(chatId, `/start ${token}`),
        sender_chat: { id: chatId },
      },
      token,
      new Date(),
    );

    expect((await getTelegramGroup(db, event.id))?.status).toBe('active');
  });

  it('tells a member who is not an admin that only an admin can connect, in the meetup language', async () => {
    const event = await seedMeetup(db, { language: 'fr' });
    const token = await openConnect(db, event);
    const chatId = nextChatId();
    const setup = devSetup(new Map([[ADMIN_ID, member('member')]]));

    await connectFromStart(
      db,
      setup,
      groupMessage(chatId, `/start ${token}`),
      token,
      new Date(),
    );

    expect(setup.provider.callsTo('sendMessage')[0]?.args).toEqual({
      chatId,
      text: `Seul un administrateur de ce groupe peut le relier à « ${event.title} ».`,
    });
    expect((await getTelegramGroup(db, event.id))?.status).toBe('pending');
  });

  it.each([
    ['inviting', { canInviteUsers: false }],
    ['removing', { canRestrictMembers: false }],
    ['pinning', { canPinMessages: false }],
    ['anything, as a plain member', { status: 'member' as const }],
  ])(
    'asks for the rights the bot lacks before it connects anything: %s',
    async (_lacking, overrides) => {
      const event = await seedMeetup(db);
      const token = await openConnect(db, event);
      const chatId = nextChatId();
      const setup = devSetup(
        new Map([
          [DEV_TELEGRAM_BOT_ID, { ...member('administrator'), ...overrides }],
        ]),
      );

      await connectFromStart(
        db,
        setup,
        groupMessage(chatId, `/start ${token}`),
        token,
        new Date(),
      );

      expect(setup.provider.callsTo('sendMessage')[0]?.args.text).toContain(
        'invite users via link, ban users and pin messages',
      );
      expect((await getTelegramGroup(db, event.id))?.status).toBe('pending');
    },
  );

  it('says nothing about a token it does not know, and stops answering a chat that keeps trying', async () => {
    const event = await seedMeetup(db);
    const chatId = nextChatId();
    const setup = devSetup(new Map([[ADMIN_ID, member('member')]]));
    const guess = (token: string) =>
      connectFromStart(
        db,
        setup,
        groupMessage(chatId, `/start ${token}`),
        token,
        new Date(),
      );

    for (let attempt = 0; attempt < 10; attempt += 1)
      await guess(`${'x'.repeat(30)}${String(attempt).padStart(2, '0')}`);
    await guess(await openConnect(db, event));

    expect(setup.provider.calls).toEqual([]);
    expect((await getTelegramGroup(db, event.id))?.status).toBe('pending');
  });

  it.each([
    ['the sender', [{ kind: 'unavailable', message: 'down' }]],
    ['the bot', [null, { kind: 'unavailable', message: 'down' }]],
  ] as const)(
    'decides nothing when Telegram will not say what %s may do',
    async (_whom, lookups) => {
      const event = await seedMeetup(db);
      const token = await openConnect(db, event);
      const chatId = nextChatId();
      const setup = devSetup(new Map(), { getChatMember: [...lookups] });

      await connectFromStart(
        db,
        setup,
        groupMessage(chatId, `/start ${token}`),
        token,
        new Date(),
      );

      expect(setup.provider.callsTo('getChatMember')).toHaveLength(2);
      expect(setup.provider.callsTo('sendMessage')).toEqual([]);
      expect((await getTelegramGroup(db, event.id))?.status).toBe('pending');
    },
  );
});
