import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import { account, createDb, eq, session, user } from '@founders-coffee/db';

import { readAccountSummary } from './account.js';

const LIVE = new Date('2099-01-01T00:00:00Z');
const EXPIRED = new Date('2020-01-01T00:00:00Z');

const setup = async (overrides: Record<string, unknown> = {}) => {
  const db = createDb(env.DB);
  const userId = id('usr');
  await db.insert(user).values({
    id: userId,
    name: 'Account Owner',
    email: `${userId}@test.coffee`,
    emailVerified: true,
    ...overrides,
  });
  return { db, userId };
};

const addProvider = (
  db: Awaited<ReturnType<typeof setup>>['db'],
  userId: string,
  providerId: string,
) =>
  db
    .insert(account)
    .values({
      id: id('acc'),
      userId,
      providerId,
      accountId: `${providerId}-external`,
      accessToken: 'super-secret-access-token',
      refreshToken: 'super-secret-refresh-token',
      idToken: 'super-secret-id-token',
      password: 'never-a-password',
    })
    .run();

const addSession = (
  db: Awaited<ReturnType<typeof setup>>['db'],
  userId: string,
  expiresAt: Date,
) =>
  db
    .insert(session)
    .values({
      id: id('ses'),
      userId,
      token: id('tok'),
      expiresAt,
    })
    .run();

describe('account summary (real D1)', () => {
  it('states the account without disclosing what identifies it', async () => {
    const { db, userId } = await setup();

    const result = await readAccountSummary(db, userId);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.email.masked).toContain('@test.coffee');
    expect(result.data.email.masked).not.toBe(`${userId}@test.coffee`);
    expect(result.data.email.verified).toBe(true);
    expect(result.data.phone).toEqual({ masked: null, verified: false });
    expect(result.data.sessionCount).toBe(0);
  });

  it('never carries a token, a password or a raw contact', async () => {
    const { db, userId } = await setup({
      phoneNumber: '+213600000042',
      phoneNumberVerified: true,
    });
    await addProvider(db, userId, 'google');

    const result = await readAccountSummary(db, userId);
    if (!result.ok) throw result.error;
    const serialized = JSON.stringify(result.data);

    for (const secret of [
      'super-secret-access-token',
      'super-secret-refresh-token',
      'super-secret-id-token',
      'never-a-password',
      `${userId}@test.coffee`,
      '+213600000042',
      '600000042',
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(result.data.phone.masked).toBe('+213 •••• 42');
  });

  it('lists each connected provider once and drops one it does not know', async () => {
    const { db, userId } = await setup();
    await addProvider(db, userId, 'google');
    await addProvider(db, userId, 'github');
    await addProvider(db, userId, 'credential');

    const result = await readAccountSummary(db, userId);
    if (!result.ok) throw result.error;

    expect([...result.data.providers].sort()).toEqual(['github', 'google']);
  });

  it('counts the sessions that are still open, not the ones that expired', async () => {
    const { db, userId } = await setup();
    await addSession(db, userId, LIVE);
    await addSession(db, userId, LIVE);
    await addSession(db, userId, EXPIRED);

    const result = await readAccountSummary(db, userId);
    if (!result.ok) throw result.error;

    expect(result.data.sessionCount).toBe(2);
  });

  it('keeps two accounts entirely separate', async () => {
    const first = await setup({ phoneNumber: '+213600000001' });
    const second = await setup();
    await addProvider(first.db, first.userId, 'google');
    await addSession(first.db, first.userId, LIVE);

    const mine = await readAccountSummary(second.db, second.userId);
    if (!mine.ok) throw mine.error;

    expect(mine.data.userId).toBe(second.userId);
    expect(mine.data.providers).toEqual([]);
    expect(mine.data.sessionCount).toBe(0);
    expect(mine.data.phone.masked).toBeNull();
  });

  it.each([
    ['banned', { banned: true }],
    ['closing', { accountState: 'closing' }],
    ['deleted', { accountState: 'deleted' }],
  ])(
    'answers a %s identity the way the rest of the owner surface does',
    async (_label, change) => {
      const { db, userId } = await setup();
      await db.update(user).set(change).where(eq(user.id, userId)).run();

      expect(await readAccountSummary(db, userId)).toMatchObject({
        ok: false,
        error: { code: 'not_found' },
      });
    },
  );

  it('reports a store failure as unavailable rather than as an empty account', async () => {
    const { userId } = await setup();
    const broken = {
      select: () => {
        throw new Error('D1 unavailable');
      },
    } as never;

    expect(await readAccountSummary(broken, userId)).toMatchObject({
      ok: false,
      error: { code: 'account_unavailable' },
    });
  });
});
