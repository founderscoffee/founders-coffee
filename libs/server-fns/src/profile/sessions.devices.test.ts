import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import {
  createDb,
  eq,
  pushSessionLinks,
  pushSubscriptions,
  seed,
  session,
  user,
} from '@founders-coffee/db';

import { callerSessionToken, readDevices, revokeDevices } from './sessions.js';

const LIVE = new Date('2099-01-01T00:00:00Z');

const SESSION_COOKIE = '__Secure-better-auth.session_token';

const cookieHeaders = (...cookies: readonly string[]): Headers =>
  new Headers({ cookie: cookies.join('; ') });

const setup = async (overrides: Record<string, unknown> = {}) => {
  const db = createDb(env.DB);
  await seed(db);
  const userId = id('usr');
  await db.insert(user).values({
    id: userId,
    name: 'Device Owner',
    email: `${userId}@test.coffee`,
    emailVerified: true,
    ...overrides,
  });
  return { db, userId };
};

const addSession = async (
  db: ReturnType<typeof createDb>,
  userId: string,
  userAgent: string,
) => {
  const sessionId = id('ses');
  const token = id('tok');
  await db
    .insert(session)
    .values({ id: sessionId, userId, token, expiresAt: LIVE, userAgent })
    .run();
  return { sessionId, token };
};

const addDevice = async (
  db: ReturnType<typeof createDb>,
  userId: string,
  sessionId: string,
) => {
  const subscriptionId = id('push');
  await db
    .insert(pushSubscriptions)
    .values({
      id: subscriptionId,
      userId,
      token: id('tok'),
      platform: 'web',
      surface: 'pwa',
      marketCode: 'DZ',
    })
    .run();
  await db
    .insert(pushSessionLinks)
    .values({ subscriptionId, sessionId, userId })
    .run();
  return subscriptionId;
};

describe('PF-07d — the device a request comes from', () => {
  it('is the one its session cookie names, whatever cookie comes first', async () => {
    const { db, userId } = await setup();
    const other = await addSession(db, userId, 'Firefox');
    const mine = await addSession(db, userId, 'Safari');
    const headers = cookieHeaders(
      `legacy.session_token=${other.token}.sig`,
      `${SESSION_COOKIE}=${mine.token}.sig`,
    );

    const result = await readDevices(db, userId, callerSessionToken(headers));
    if (!result.ok) throw result.error;

    expect(
      result.data.sessions.filter((row) => row.isCurrent).map((row) => row.id),
      'another cookie whose name ends in session_token was taken for the caller',
    ).toEqual([mine.sessionId]);
  });

  it('survives signing out every other device, whatever cookie comes first', async () => {
    const { db, userId } = await setup();
    const other = await addSession(db, userId, 'Old phone');
    const mine = await addSession(db, userId, 'Laptop');
    const headers = cookieHeaders(
      `legacy.session_token=${other.token}.sig`,
      `${SESSION_COOKIE}=${mine.token}.sig`,
    );

    const result = await revokeDevices(
      db,
      userId,
      { othersOnly: true },
      callerSessionToken(headers),
    );

    expect(result).toMatchObject({ ok: true, data: { revoked: 1 } });
    const left = await db
      .select()
      .from(session)
      .where(eq(session.userId, userId));
    expect(
      left.map((row) => row.id),
      "the caller's own session was ended and the other device kept",
    ).toEqual([mine.sessionId]);
  });

  it('is none when only a cookie Better Auth never sets names a session', async () => {
    const { db, userId } = await setup();
    const mine = await addSession(db, userId, 'Laptop');
    const headers = cookieHeaders(
      `better-auth.session_token=${mine.token}.sig`,
    );

    const result = await readDevices(db, userId, callerSessionToken(headers));
    if (!result.ok) throw result.error;

    expect(result.data.sessions.some((row) => row.isCurrent)).toBe(false);
  });
});

describe('PF-07d — the devices a member can see', () => {
  it('names each session by an id and never by its token', async () => {
    const { db, userId } = await setup();
    const first = await addSession(db, userId, 'Firefox');
    await addSession(db, userId, 'Safari');

    const result = await readDevices(db, userId, first.token);
    if (!result.ok) throw result.error;

    expect(result.data.sessions).toHaveLength(2);
    expect(JSON.stringify(result.data)).not.toContain(first.token);
    expect(result.data.sessions.map((row) => row.userAgent).sort()).toEqual([
      'Firefox',
      'Safari',
    ]);
  });

  it('marks the device that is asking, and only that one', async () => {
    const { db, userId } = await setup();
    const mine = await addSession(db, userId, 'Firefox');
    await addSession(db, userId, 'Safari');

    const result = await readDevices(db, userId, mine.token);
    if (!result.ok) throw result.error;

    expect(
      result.data.sessions.filter((row) => row.isCurrent).map((row) => row.id),
    ).toEqual([mine.sessionId]);
  });

  it('shows no current device when the caller has no session of its own', async () => {
    const { db, userId } = await setup();
    await addSession(db, userId, 'Firefox');

    const result = await readDevices(db, userId, null);
    if (!result.ok) throw result.error;

    expect(result.data.sessions.some((row) => row.isCurrent)).toBe(false);
  });

  it("never lists another member's device", async () => {
    const mine = await setup();
    const theirs = await setup();
    await addSession(mine.db, mine.userId, 'Mine');
    await addSession(theirs.db, theirs.userId, 'Theirs');

    const result = await readDevices(mine.db, mine.userId, null);
    if (!result.ok) throw result.error;

    expect(result.data.sessions.map((row) => row.userAgent)).toEqual(['Mine']);
  });
});

describe('PF-07d — signing a device out', () => {
  it('takes the device push registration with it', async () => {
    const { db, userId } = await setup();
    const target = await addSession(db, userId, 'Old phone');
    const subscriptionId = await addDevice(db, userId, target.sessionId);
    const current = await addSession(db, userId, 'Laptop');

    const result = await revokeDevices(
      db,
      userId,
      { sessionId: target.sessionId },
      current.token,
    );

    expect(result).toMatchObject({ ok: true, data: { revoked: 1 } });
    expect(
      await db
        .select()
        .from(pushSubscriptions)
        .where(eq(pushSubscriptions.id, subscriptionId)),
    ).toEqual([]);
  });

  it("refuses a session id that is not the caller's", async () => {
    const mine = await setup();
    const theirs = await setup();
    const target = await addSession(theirs.db, theirs.userId, 'Theirs');
    const current = await addSession(mine.db, mine.userId, 'Mine');

    const result = await revokeDevices(
      mine.db,
      mine.userId,
      { sessionId: target.sessionId },
      current.token,
    );

    expect(result).toMatchObject({ ok: false, error: { code: 'not_found' } });
    expect(
      await theirs.db
        .select()
        .from(session)
        .where(eq(session.id, target.sessionId)),
    ).toHaveLength(1);
  });

  it('ends every other device and keeps the one asking', async () => {
    const { db, userId } = await setup();
    const current = await addSession(db, userId, 'Laptop');
    await addSession(db, userId, 'Old phone');
    await addSession(db, userId, 'Library computer');

    const result = await revokeDevices(
      db,
      userId,
      { othersOnly: true },
      current.token,
    );

    expect(result).toMatchObject({ ok: true, data: { revoked: 2 } });
    const left = await db
      .select()
      .from(session)
      .where(eq(session.userId, userId));
    expect(left.map((row) => row.id)).toEqual([current.sessionId]);
  });

  it('answers not-found rather than ending nothing quietly', async () => {
    const { db, userId } = await setup();
    const current = await addSession(db, userId, 'Laptop');

    expect(
      await revokeDevices(db, userId, { sessionId: 'ses_nope' }, current.token),
    ).toMatchObject({ ok: false, error: { code: 'not_found' } });
  });
});
