import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import {
  account,
  createDb,
  eq,
  seed,
  unlinkProviderIfNotLast,
  user,
} from '@founders-coffee/db';

import { unlinkProvider, unlinkProviderIfNotLast } from './sessions.js';

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

const addProvider = (
  db: ReturnType<typeof createDb>,
  userId: string,
  providerId: string,
) =>
  db
    .insert(account)
    .values({
      id: id('acc'),
      userId,
      providerId,
      accountId: `${providerId}-x`,
      accessToken: 'secret-token',
    })
    .run();

describe('PF-07d — disconnecting a sign-in method', () => {
  it('disconnects a provider while a code to the address still works', async () => {
    const { db, userId } = await setup();
    await addProvider(db, userId, 'google');

    expect(await unlinkProvider(db, userId, 'google')).toMatchObject({
      ok: true,
    });
    expect(
      await db.select().from(account).where(eq(account.userId, userId)),
    ).toEqual([]);
  });

  it('counts the address itself, so a sole provider is still safe to disconnect', async () => {
    const { db, userId } = await setup();
    await addProvider(db, userId, 'github');

    expect(await unlinkProvider(db, userId, 'github')).toMatchObject({
      ok: true,
    });
  });

  it('has nothing to unlink for an account that never linked one', async () => {
    const { db, userId } = await setup();

    expect(await unlinkProvider(db, userId, 'google')).toMatchObject({
      ok: false,
      error: { code: 'last_sign_in_method' },
    });
  });

  it('lets the second-to-last go and refuses the last, with no other way in', async () => {
    const { db, userId } = await setup();
    await addProvider(db, userId, 'google');
    await addProvider(db, userId, 'github');

    expect(
      await unlinkProviderIfNotLast(db, {
        userId,
        providerId: 'google',
        otherMethods: 0,
      }),
    ).toBe(true);
    expect(
      await unlinkProviderIfNotLast(db, {
        userId,
        providerId: 'github',
        otherMethods: 0,
      }),
    ).toBe(false);
    expect(
      await db.select().from(account).where(eq(account.userId, userId)),
    ).toHaveLength(1);
  });

  it('decides in the statement, so two racing unlinks cannot both win', async () => {
    const { db, userId } = await setup();
    await addProvider(db, userId, 'google');
    await addProvider(db, userId, 'github');

    const [first, second] = await Promise.all([
      unlinkProviderIfNotLast(db, {
        userId,
        providerId: 'google',
        otherMethods: 0,
      }),
      unlinkProviderIfNotLast(db, {
        userId,
        providerId: 'github',
        otherMethods: 0,
      }),
    ]);

    expect([first, second].filter(Boolean)).toHaveLength(1);
    expect(
      await db.select().from(account).where(eq(account.userId, userId)),
    ).toHaveLength(1);
  });
});
