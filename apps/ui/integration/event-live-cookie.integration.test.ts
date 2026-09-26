import { describe, expect, it } from 'vitest';

import {
  connectWithCookie,
  ofType,
  seedLiveRoom,
  sessionCookie,
  typeOf,
  whileD1Fails,
  type LiveClient,
} from './event-live.fixtures';

const TOLD_NO_SESSION = {
  close: { code: 4001, reason: 'auth_expired' },
  frames: ['auth_expired'],
};

const otherCookies = (count: number): string =>
  Array.from(
    { length: count },
    (_, index) => `pad_${index}=tok_pad_${index}.signature`,
  ).join('; ');

const verdict = async (client: LiveClient) => ({
  close: await client.waitForClose(),
  frames: client.frames.map(typeOf),
});

describe('the cookie an upgrade is verified by', () => {
  it('admits a member whose session cookie comes after a thousand others', async () => {
    const room = await seedLiveRoom();

    const client = await connectWithCookie(
      room.eventId,
      `${otherCookies(1000)}; ${sessionCookie(room.guestToken)}`,
    );

    await client.waitFor(ofType('auth_ok'));
  });

  it('asks D1 about no other cookie, however many there are', async () => {
    const room = await seedLiveRoom();
    const cookie = [
      otherCookies(1000),
      `theme=${room.guestToken}.signature`,
      `better-auth.session_token=${room.guestToken}.signature`,
    ].join('; ');

    const client = await whileD1Fails(() =>
      connectWithCookie(room.eventId, cookie),
    );

    expect(
      await verdict(client),
      'any query would have failed, and a failed query asks the browser to retry on 1013',
    ).toEqual(TOLD_NO_SESSION);
  });

  it.each([
    ['an unrelated cookie', 'theme'],
    [
      'the unprefixed name Better Auth never sets here',
      'better-auth.session_token',
    ],
  ])('admits nobody on a session held in %s', async (_, name) => {
    const room = await seedLiveRoom();

    const client = await connectWithCookie(
      room.eventId,
      `${name}=${room.guestToken}.signature`,
    );

    expect(await verdict(client)).toEqual(TOLD_NO_SESSION);
  });

  it('reads the first copy of the session cookie and no other', async () => {
    const room = await seedLiveRoom();

    const client = await connectWithCookie(
      room.eventId,
      `${sessionCookie('tok_unknown')}; ${sessionCookie(room.guestToken)}`,
    );

    expect(await verdict(client)).toEqual(TOLD_NO_SESSION);
  });
});
