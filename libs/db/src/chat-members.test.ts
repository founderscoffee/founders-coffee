import { beforeEach, describe, expect, it } from 'vitest';

import { getChatChannel } from './chat-channels.js';
import {
  getChatMemberState,
  markChatRead,
  setChatMuted,
} from './chat-members.js';
import { going, newMember, publishMeetup } from './chat.fixtures.js';
import type { Db } from './index.js';
import { HOST_ID, setupDb } from './rsvps.fixtures.js';

describe('markChatRead and setChatMuted (real D1)', () => {
  let db: Db;
  let eventId: string;
  let channelId: string;
  let member: string;

  beforeEach(async () => {
    db = await setupDb();
    eventId = await publishMeetup(db);
    channelId = (await getChatChannel(db, eventId))?.id ?? '';
    member = await newMember(db);
    await going(db, eventId, member);
  });

  const stateOf = (userId: string) =>
    getChatMemberState(db, { channelId, userId });

  it('records how far a member has read, and only ever moves it forward', async () => {
    const read = Date.now() - 60_000;

    expect(await markChatRead(db, { eventId, userId: member, at: read })).toBe(
      true,
    );
    await markChatRead(db, { eventId, userId: member, at: read - 30_000 });
    expect((await stateOf(member))?.lastReadAt).toEqual(new Date(read));

    await markChatRead(db, { eventId, userId: member, at: read + 1_000 });
    expect((await stateOf(member))?.lastReadAt).toEqual(new Date(read + 1_000));
  });

  it("never marks the chat read past the database's clock", async () => {
    await markChatRead(db, {
      eventId,
      userId: member,
      at: Date.now() + 24 * 60 * 60 * 1000,
    });

    const lastReadAt = (await stateOf(member))?.lastReadAt?.getTime() ?? 0;
    expect(Math.abs(lastReadAt - Date.now())).toBeLessThan(60_000);
  });

  it('writes nothing for someone who is not in the chat', async () => {
    const stranger = await newMember(db);

    expect(
      await markChatRead(db, { eventId, userId: stranger, at: Date.now() }),
    ).toBe(false);
    expect(
      await setChatMuted(db, { eventId, userId: stranger, muted: true }),
    ).toBe(false);
    expect(await stateOf(stranger)).toBeUndefined();
  });

  it('mutes and unmutes the chat, keeping how far the member has read', async () => {
    const read = Date.now() - 60_000;
    await markChatRead(db, { eventId, userId: member, at: read });

    await setChatMuted(db, { eventId, userId: member, muted: true });
    expect(await stateOf(member)).toMatchObject({
      muted: true,
      lastReadAt: new Date(read),
    });

    await setChatMuted(db, { eventId, userId: member, muted: false });
    expect(await stateOf(member)).toMatchObject({
      muted: false,
      lastReadAt: new Date(read),
    });
  });

  it('keeps a chat muted when its member reads it again', async () => {
    await setChatMuted(db, { eventId, userId: HOST_ID, muted: true });
    expect((await stateOf(HOST_ID))?.lastReadAt).toBeNull();

    await markChatRead(db, { eventId, userId: HOST_ID, at: Date.now() });

    expect((await stateOf(HOST_ID))?.muted).toBe(true);
    expect((await stateOf(HOST_ID))?.lastReadAt).toBeInstanceOf(Date);
  });
});
