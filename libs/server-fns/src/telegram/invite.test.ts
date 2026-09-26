import { beforeEach, describe, expect, it } from 'vitest';

import { getTelegramInvite, type Db } from '@founders-coffee/db';

import { requestTelegramInviteResolver } from './invite.js';
import type { TelegramSetup } from './config.js';
import {
  attend,
  connectMeetup,
  devSetup,
  MEMBER_IDS,
  openConnect,
  seedMeetup,
  setupDb,
} from './telegram.fixtures.js';

describe("a member's invite into a meetup's Telegram group (real D1 via Miniflare)", () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  const request = (
    setup: TelegramSetup | null,
    eventId: string,
    userId: string = MEMBER_IDS[0],
    now = new Date(),
  ) => requestTelegramInviteResolver(db, setup, { eventId, userId, now });

  const goingTo = async () => {
    const event = await seedMeetup(db);
    const chatId = await connectMeetup(db, event);
    await attend(db, event.id, MEMBER_IDS[0]);
    return { event, chatId };
  };

  it('gives a going member their own link, made once and kept', async () => {
    const { event, chatId } = await goingTo();
    const setup = devSetup();

    const first = await request(setup, event.id);
    const again = await request(setup, event.id);

    expect(first.ok && first.data.inviteLink).toMatch(/^https:\/\/t\.me\/\+/);
    expect(again).toEqual(first);
    expect(setup.provider.calls).toEqual([
      { method: 'createInviteLink', args: { chatId } },
    ]);
    expect(
      (
        await getTelegramInvite(db, {
          eventId: event.id,
          userId: MEMBER_IDS[0],
        })
      )?.inviteLink,
    ).toBe(first.ok ? first.data.inviteLink : null);
  });

  it('refuses a member who is not going', async () => {
    const { event } = await goingTo();
    const setup = devSetup();

    const result = await request(setup, event.id, MEMBER_IDS[1]);

    expect(!result.ok && result.error.code).toBe('rsvp_not_found');
    expect(setup.provider.calls).toEqual([]);
  });

  it('refuses where there is no group to join: none yet, none running, no bot, or past its day', async () => {
    const setup = devSetup();
    const unconnected = await seedMeetup(db);
    await attend(db, unconnected.id, MEMBER_IDS[0]);
    const waiting = await seedMeetup(db);
    await openConnect(db, waiting);
    await attend(db, waiting.id, MEMBER_IDS[0]);
    const { event: running } = await goingTo();

    const codes = [
      await request(setup, unconnected.id),
      await request(setup, waiting.id),
      await request(null, running.id),
      await request(
        setup,
        running.id,
        MEMBER_IDS[0],
        new Date('2099-01-16T20:00:00Z'),
      ),
    ].map((result) => !result.ok && result.error.code);

    expect(codes).toEqual(
      Array.from({ length: 4 }, () => 'telegram_group_unavailable'),
    );
    expect(setup.provider.calls).toEqual([]);
  });

  it('keeps nothing when Telegram will not make a link, so asking again can succeed', async () => {
    const { event } = await goingTo();
    const setup = devSetup(new Map(), {
      createInviteLink: [{ kind: 'unavailable', message: 'down' }],
    });

    const refused = await request(setup, event.id);
    const retried = await request(setup, event.id);

    expect(!refused.ok && refused.error.code).toBe('telegram_unavailable');
    expect(retried.ok).toBe(true);
  });

  it('leaves no working spare link when two requests race', async () => {
    const { event, chatId } = await goingTo();
    const setup = devSetup();

    const [first, second] = await Promise.all([
      request(setup, event.id),
      request(setup, event.id),
    ]);

    const kept = first.ok ? first.data.inviteLink : '';
    expect(second).toEqual(first);
    const made = setup.provider.callsTo('createInviteLink').length;
    const revoked = setup.provider.callsTo('revokeInviteLink');
    expect(revoked).toHaveLength(made - 1);
    for (const call of revoked) {
      expect(call.args.chatId).toBe(chatId);
      expect(call.args.inviteLink).not.toBe(kept);
    }
  });
});
