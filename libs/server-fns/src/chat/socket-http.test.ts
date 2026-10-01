import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';

import { createAuth, DevEmailProvider } from '@founders-coffee/auth';
import { CHAT_ROOM_CLOSES, id } from '@founders-coffee/core';
import { createRsvp, eq, user, type Db } from '@founders-coffee/db';

import { goingMember, publishMeetup, setupDb } from './chat.fixtures.js';
import {
  listen,
  membersIn,
  ORIGIN,
  signIn,
  upgradeFor,
} from './room.fixtures.js';
import { handleChatSocketRequest } from './socket-http.js';

const through = async (request: Request): Promise<Response> => {
  const response = handleChatSocketRequest(request, new URL(request.url));
  if (!response) throw new Error(`${request.url} is not the chat's route`);
  return response;
};

/**
 * Sign a member in through Better Auth itself, and return the cookies their browser would send and
 * who they are. The session is signed with the secret the route's session read verifies against.
 */
const signInThroughBetterAuth = async (
  db: Db,
  email: string,
): Promise<{ cookie: string; userId: string }> => {
  const workerEnv = env as unknown as {
    DB: D1Database;
    BETTER_AUTH_SECRET: string;
    APP_URL: string;
  };
  const emailProvider = new DevEmailProvider();
  const { auth } = createAuth(
    {
      DB: workerEnv.DB,
      BETTER_AUTH_SECRET: workerEnv.BETTER_AUTH_SECRET,
      APP_URL: workerEnv.APP_URL,
      TURNSTILE_DISABLED: 'true',
    },
    { emailProvider },
  );
  const post = (path: string, body: unknown): Promise<Response> =>
    auth.handler(
      new Request(`${workerEnv.APP_URL}/api/auth${path}`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: workerEnv.APP_URL,
        },
        body: JSON.stringify(body),
      }),
    );
  await post('/email-otp/send-verification-otp', { email, type: 'sign-in' });
  const response = await post('/sign-in/email-otp', {
    email,
    otp: emailProvider.sent[0]?.otp ?? '',
  });
  const cookie = response.headers
    .getSetCookie()
    .map((line) => line.split(';')[0])
    .join('; ');
  const [signedIn] = await db.select().from(user).where(eq(user.email, email));
  if (!signedIn) throw new Error(`${email} was not signed in`);
  return { cookie, userId: signedIn.id };
};

describe('the route to a chat room (real D1 and Durable Objects via Miniflare)', () => {
  let db: Db;
  let eventId: string;

  beforeAll(async () => {
    db = await setupDb();
    eventId = await publishMeetup(db);
  });

  it('answers only the paths under /api/chat/', () => {
    const request = new Request(`${ORIGIN}/api/live/${eventId}`);

    expect(handleChatSocketRequest(request, new URL(request.url))).toBeNull();
  });

  it('turns away a longer path, another method and a request without the upgrade', async () => {
    const longer = await through(
      new Request(`${ORIGIN}/api/chat/${eventId}/evt_elsewhere`, {
        headers: { Upgrade: 'websocket' },
      }),
    );
    const posted = await through(
      new Request(`${ORIGIN}/api/chat/${eventId}`, {
        method: 'POST',
        headers: { Upgrade: 'websocket' },
      }),
    );
    const plain = await through(new Request(`${ORIGIN}/api/chat/${eventId}`));

    expect(longer.status).toBe(404);
    expect(posted.status).toBe(405);
    expect(posted.headers.get('Allow')).toBe('GET');
    expect(plain.status).toBe(426);
    expect(
      [longer, posted, plain].map((response) => response.webSocket),
    ).toEqual([null, null, null]);
  });

  it('turns away a socket another site opens, whoever is signed in', async () => {
    const member = await goingMember(db, eventId);
    const token = await signIn(db, member);

    const foreignOrigin = await through(
      upgradeFor(eventId, token, { Origin: 'https://elsewhere.example' }),
    );
    const crossSite = await through(
      upgradeFor(eventId, token, { 'Sec-Fetch-Site': 'cross-site' }),
    );

    expect([foreignOrigin.status, crossSite.status]).toEqual([403, 403]);
    expect(await membersIn(eventId)).not.toContain(member);
  });

  it('lets a member in on the upgrade their browser sends from the site', async () => {
    const member = await goingMember(db, eventId);

    const response = await through(
      upgradeFor(eventId, await signIn(db, member), {
        Origin: ORIGIN,
        'Sec-Fetch-Site': 'same-origin',
      }),
    );

    expect(response.status).toBe(101);
    expect(await membersIn(eventId)).toContain(member);
  });

  it('hands a signed-out upgrade to the room, which tells the page to sign in again', async () => {
    const response = await through(upgradeFor(eventId));

    expect(await listen(response).waitForClose()).toEqual(
      CHAT_ROOM_CLOSES.noSession,
    );
  });

  it('counts connections against the member, not against an address they share', async () => {
    const address = { 'cf-connecting-ip': '203.0.113.47' };
    const answers: number[] = [];
    for (let n = 0; n < 31; n += 1)
      answers.push(
        (await through(upgradeFor(eventId, undefined, address))).status,
      );
    const { cookie, userId } = await signInThroughBetterAuth(
      db,
      'chat-socket-budget@example.dz',
    );
    await createRsvp(db, { id: id('rsv'), eventId, userId });

    const member = await through(
      upgradeFor(eventId, undefined, { ...address, Cookie: cookie }),
    );

    expect(answers.slice(0, 30).every((status) => status === 101)).toBe(true);
    expect(answers[30]).toBe(429);
    expect(member.status).toBe(101);
    expect(await membersIn(eventId)).toContain(userId);
  });
});
