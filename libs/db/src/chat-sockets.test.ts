import { beforeAll, describe, expect, it } from 'vitest';

import { readChatSocketSessions } from './chat-sockets.js';
import {
  going,
  newMember,
  publishMeetup,
  setAccount,
  signIn,
  switchChat,
} from './chat.fixtures.js';
import type { Db } from './index.js';
import { HOST_ID, setupDb } from './rsvps.fixtures.js';

describe("a chat room's sessions (real D1)", () => {
  let db: Db;
  let eventId: string;

  beforeAll(async () => {
    db = await setupDb();
    eventId = await publishMeetup(db);
  });

  const read = (sessionTokens: readonly string[], forEvent = eventId) =>
    readChatSocketSessions(db, { eventId: forEvent, sessionTokens });

  it('answers every signed-in session in one read, with whether its user is in the chat', async () => {
    const member = await newMember(db);
    await going(db, eventId, member);
    const stranger = await newMember(db);
    const tokens = {
      host: await signIn(db, HOST_ID),
      member: await signIn(db, member),
      stranger: await signIn(db, stranger),
    };

    const sessions = await read(Object.values(tokens));

    expect(sessions).toHaveLength(3);
    expect(sessions).toEqual(
      expect.arrayContaining([
        { sessionToken: tokens.host, userId: HOST_ID, isMember: true },
        { sessionToken: tokens.member, userId: member, isMember: true },
        { sessionToken: tokens.stranger, userId: stranger, isMember: false },
      ]),
    );
  });

  it('has nothing for a token nobody holds or a session that has expired', async () => {
    const member = await newMember(db);
    await going(db, eventId, member);
    const expired = await signIn(db, member, -1);

    expect(await read(['tok_nobody', expired])).toEqual([]);
    expect(await read([])).toEqual([]);
  });

  it('keeps a banned member, and one closing their account, out of the chat they are going to', async () => {
    const banned = await newMember(db);
    const closing = await newMember(db);
    await going(db, eventId, banned);
    await going(db, eventId, closing);
    await setAccount(db, banned, { banned: true });
    await setAccount(db, closing, { accountState: 'closing' });

    const sessions = await read([
      await signIn(db, banned),
      await signIn(db, closing),
    ]);

    expect(sessions.map((entry) => entry.isMember)).toEqual([false, false]);
  });

  it('calls a signed-in reader of a meetup that does not exist a non-member, not signed out', async () => {
    const token = await signIn(db, HOST_ID);

    expect(await read([token], 'evt_never_published')).toEqual([
      { sessionToken: token, userId: HOST_ID, isMember: false },
    ]);
  });

  it('reads more sessions in one statement than D1 binds parameters', async () => {
    const token = await signIn(db, HOST_ID);
    const strangers = Array.from({ length: 150 }, (_, n) => `tok_none_${n}`);

    expect(await read([...strangers, token])).toEqual([
      { sessionToken: token, userId: HOST_ID, isMember: true },
    ]);
  });

  it('lets nobody in while the market has the chat switched off', async () => {
    const token = await signIn(db, HOST_ID);
    await switchChat(db, 'DZ', 'false');
    try {
      expect(await read([token])).toEqual([
        { sessionToken: token, userId: HOST_ID, isMember: false },
      ]);
    } finally {
      await switchChat(db, 'DZ', 'true');
    }
  });
});
