import { beforeEach, describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import {
  getTelegramGroup,
  getTelegramInvite,
  saveTelegramInvite,
  type Db,
} from '@founders-coffee/db';
import { DEV_TELEGRAM_BOT_ID } from '@founders-coffee/notifications';

import {
  handleTelegramWebhook,
  serveTelegramWebhook,
  TELEGRAM_WEBHOOK_PATH,
} from './webhook.js';
import {
  attend,
  BOT_USERNAME,
  connectMeetup,
  devSetup,
  groupMessage,
  MEMBER_IDS,
  nextChatId,
  openConnect,
  seedMeetup,
  setupDb,
  WEBHOOK_SECRET,
} from './telegram.fixtures.js';

const ACCOUNT = 7200000001;
const URL_BASE = 'https://founders.coffee';

const call = (body: unknown, secret: string | null = WEBHOOK_SECRET) =>
  new Request(`${URL_BASE}${TELEGRAM_WEBHOOK_PATH}`, {
    method: 'POST',
    headers: secret ? { 'x-telegram-bot-api-secret-token': secret } : {},
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });

describe('the Telegram webhook (real D1 via Miniflare)', () => {
  let db: Db;
  let updateId = 0;

  beforeEach(async () => {
    db = await setupDb();
  });

  const update = (fields: Record<string, unknown>) => ({
    update_id: ++updateId,
    ...fields,
  });

  it('answers only a POST to its own path', () => {
    const get = new Request(`${URL_BASE}${TELEGRAM_WEBHOOK_PATH}`);
    const elsewhere = new Request(`${URL_BASE}/api/telegram/other`, {
      method: 'POST',
    });

    expect(handleTelegramWebhook(get, new URL(get.url))).toBeNull();
    expect(handleTelegramWebhook(elsewhere, new URL(elsewhere.url))).toBeNull();
  });

  it('is not there without a bot, and refuses a call without the secret', async () => {
    const event = await seedMeetup(db);
    const token = await openConnect(db, event);
    const chatId = nextChatId();
    const start = update({ message: groupMessage(chatId, `/start ${token}`) });
    const setup = devSetup();

    expect((await serveTelegramWebhook(call(start), null)).status).toBe(404);
    expect((await serveTelegramWebhook(call(start, null), setup)).status).toBe(
      401,
    );
    expect(
      (await serveTelegramWebhook(call(start, 'wrong-secret'), setup)).status,
    ).toBe(401);
    expect((await getTelegramGroup(db, event.id))?.status).toBe('pending');
    expect(setup.provider.calls).toEqual([]);
  });

  it('connects a group through the /start Telegram posts when the bot is added, and no private chat', async () => {
    const event = await seedMeetup(db);
    const token = await openConnect(db, event);
    const chatId = nextChatId();
    const start = (type: string) =>
      serveTelegramWebhook(
        call(
          update({
            message: {
              ...groupMessage(chatId, `/start@${BOT_USERNAME} ${token}`),
              chat: { id: chatId, type },
            },
          }),
        ),
        devSetup(),
      );

    await start('private');
    expect((await getTelegramGroup(db, event.id))?.status).toBe('pending');
    const response = await start('group');

    expect(response.status).toBe(200);
    expect(await getTelegramGroup(db, event.id)).toMatchObject({
      status: 'active',
      chatId,
    });
  });

  it('answers 200 to what it cannot read, will not read or does not act on, and does nothing', async () => {
    const event = await seedMeetup(db);
    const token = await openConnect(db, event);
    const setup = devSetup();
    const chatId = nextChatId();

    for (const body of [
      'not json',
      { update_id: 'x' },
      update({ message: groupMessage(chatId, 'Is anyone bringing a laptop?') }),
      {
        ...update({ message: groupMessage(chatId, `/start ${token}`) }),
        padding: 'x'.repeat(70 * 1024),
      },
    ])
      expect((await serveTelegramWebhook(call(body), setup)).status).toBe(200);
    expect(setup.provider.calls).toEqual([]);
    expect((await getTelegramGroup(db, event.id))?.status).toBe('pending');
  });

  it('follows a group Telegram upgrades, and closes what a removed bot ran', async () => {
    const upgraded = await seedMeetup(db);
    const oldChat = await connectMeetup(db, upgraded);
    const newChat = nextChatId();
    const removed = await seedMeetup(db);
    const removedChat = await connectMeetup(db, removed);
    const setup = devSetup();

    await serveTelegramWebhook(
      call(
        update({
          message: {
            chat: { id: oldChat, type: 'group' },
            migrate_to_chat_id: newChat,
          },
        }),
      ),
      setup,
    );
    const memberChange = (status: string, userId: number) =>
      serveTelegramWebhook(
        call(
          update({
            my_chat_member: {
              chat: { id: removedChat, type: 'supergroup' },
              new_chat_member: { status, user: { id: userId } },
            },
          }),
        ),
        setup,
      );
    await memberChange('administrator', DEV_TELEGRAM_BOT_ID);
    await memberChange('kicked', ACCOUNT);
    expect((await getTelegramGroup(db, removed.id))?.status).toBe('active');
    await memberChange('kicked', DEV_TELEGRAM_BOT_ID);

    expect((await getTelegramGroup(db, upgraded.id))?.chatId).toBe(newChat);
    expect((await getTelegramGroup(db, removed.id))?.status).toBe('closed');
  });

  it("approves a going member through their link, turns others away, and leaves the host's links alone", async () => {
    const event = await seedMeetup(db);
    const chatId = await connectMeetup(db, event);
    await attend(db, event.id, MEMBER_IDS[0]);
    await saveTelegramInvite(db, {
      id: id('tgi'),
      eventId: event.id,
      userId: MEMBER_IDS[0],
      inviteLink: 'https://t.me/+webhookmember',
      now: new Date(),
    });
    const setup = devSetup();
    const request = (
      from: number,
      inviteLink: string,
      creator = DEV_TELEGRAM_BOT_ID,
    ) =>
      serveTelegramWebhook(
        call(
          update({
            chat_join_request: {
              chat: { id: chatId, type: 'supergroup' },
              from: { id: from },
              invite_link: {
                invite_link: inviteLink,
                creator: { id: creator },
              },
            },
          }),
        ),
        setup,
      );

    await request(ACCOUNT, 'https://t.me/+webhookmember');
    await request(ACCOUNT + 1, 'https://t.me/+webhookmember');
    await request(ACCOUNT + 2, 'https://t.me/+hostslink', 5100000009);

    expect(setup.provider.calls).toEqual([
      { method: 'approveJoinRequest', args: { chatId, userId: ACCOUNT } },
      { method: 'declineJoinRequest', args: { chatId, userId: ACCOUNT + 1 } },
    ]);
    expect(
      (
        await getTelegramInvite(db, {
          eventId: event.id,
          userId: MEMBER_IDS[0],
        })
      )?.telegramUserId,
    ).toBe(ACCOUNT);
  });

  it("leaves join requests past a chat's budget waiting for the host", async () => {
    const event = await seedMeetup(db);
    const chatId = await connectMeetup(db, event);
    const setup = devSetup();
    const request = (from: number) =>
      serveTelegramWebhook(
        call(
          update({
            chat_join_request: {
              chat: { id: chatId, type: 'supergroup' },
              from: { id: from },
              invite_link: {
                invite_link: 'https://t.me/+unknown',
                creator: { id: DEV_TELEGRAM_BOT_ID },
              },
            },
          }),
        ),
        setup,
      );

    for (let index = 0; index < 61; index += 1) await request(ACCOUNT + index);

    expect(setup.provider.callsTo('declineJoinRequest')).toHaveLength(60);
  });
});
