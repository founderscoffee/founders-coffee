import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';
import {
  and,
  createDb,
  createEvent,
  createRsvp,
  eq,
  eventRsvps,
  getEvent,
  initializeMemberProfile,
  listClosingAccounts,
  reserveProfileAsset,
  scheduledNotifications,
  seed,
  user,
  type Db,
} from '@founders-coffee/db';
import { R2PhotoStore, type PhotoStore } from '@founders-coffee/infra';

import {
  carryAccountClosure,
  sweepClosingAccounts,
} from './account-closure.js';

const HOUR_MS = 3_600_000;
const fromNow = (hours: number) => new Date(Date.now() + hours * HOUR_MS);

const photos = () =>
  new R2PhotoStore(
    (env as unknown as { PROFILE_ASSETS: R2Bucket }).PROFILE_ASSETS,
  );

const setup = async (): Promise<Db> => {
  const db = createDb(env.DB);
  await seed(db);
  return db;
};

const member = async (db: Db, name: string) => {
  const userId = id('usr');
  await db
    .insert(user)
    .values({ id: userId, name, email: `${userId}@closure.test` });
  await initializeMemberProfile(db, userId);
  return userId;
};

let slugs = 0;
const meetup = async (db: Db, hostId: string, startsAt: Date) => {
  const eventId = id('evt');
  await createEvent(db, {
    id: eventId,
    slug: `account-closure-${++slugs}`,
    hostId,
    marketCode: 'DZ',
    stateCode: '16',
    cityCode: '1',
    title: `Account closure ${slugs}`,
    description: 'Account closure fixture.',
    venue: 'Café des Délices, Hydra',
    startsAt,
    endsAt: new Date(startsAt.getTime() + 2 * HOUR_MS),
    language: 'ar',
  });
  return eventId;
};

const close = async (db: Db, userId: string) => {
  await db
    .update(user)
    .set({ accountState: 'closing', closedAt: fromNow(-1) })
    .where(eq(user.id, userId));
  const due = await listClosingAccounts(db, { now: new Date(), limit: 100 });
  const account = due.find((row) => row.id === userId);
  if (!account) throw new Error('the account is not due for closure');
  return account;
};

const stateOf = async (db: Db, userId: string) =>
  (await db.select().from(user).where(eq(user.id, userId)))[0]?.accountState;

describe('carrying an account closure through (#105, real D1 and R2)', () => {
  it('cancels a meetup the member hosts that has not started, and tells whoever was going', async () => {
    const db = await setup();
    const host = await member(db, 'Nadia');
    const guest = await member(db, 'Karim');
    const eventId = await meetup(db, host, fromNow(24 * 7));
    await createRsvp(db, { id: id('rsv'), eventId, userId: guest });

    const outcome = await carryAccountClosure(
      db,
      await close(db, host),
      photos(),
    );

    expect(outcome).toBe('erased');
    expect((await getEvent(db, eventId))?.status).toBe('cancelled');
    expect(
      await db
        .select({ template: scheduledNotifications.templateKey })
        .from(scheduledNotifications)
        .where(
          and(
            eq(scheduledNotifications.eventId, eventId),
            eq(scheduledNotifications.userId, guest),
          ),
        ),
    ).toContainEqual({ template: 'event_cancelled' });
  });

  it("gives back the member's seat at another host's meetup", async () => {
    const db = await setup();
    const host = await member(db, 'Lina');
    const leaving = await member(db, 'Samir');
    const eventId = await meetup(db, host, fromNow(24 * 3));
    await createRsvp(db, { id: id('rsv'), eventId, userId: leaving });

    const outcome = await carryAccountClosure(
      db,
      await close(db, leaving),
      photos(),
    );

    expect(outcome).toBe('erased');
    expect((await getEvent(db, eventId))?.rsvps).toBe(0);
    expect(
      await db.select().from(eventRsvps).where(eq(eventRsvps.userId, leaving)),
    ).toEqual([]);
  });

  it('waits while a meetup the member hosts is under way', async () => {
    const db = await setup();
    const host = await member(db, 'Walid');
    const eventId = await meetup(db, host, fromNow(-0.5));

    const outcome = await carryAccountClosure(
      db,
      await close(db, host),
      photos(),
    );

    expect(outcome).toBe('waiting_on_meetup');
    expect((await getEvent(db, eventId))?.status).toBe('published');
    expect(await stateOf(db, host)).toBe('closing');
  });

  it('waits for a Telegram removal still queued under the member, then erases', async () => {
    const db = await setup();
    const host = await member(db, 'Amel');
    const leaving = await member(db, 'Yasmine');
    const eventId = await meetup(db, host, fromNow(-48));
    await db.insert(scheduledNotifications).values({
      id: id('ntf'),
      eventId,
      userId: leaving,
      channel: 'telegram',
      templateKey: 'telegram_member_removed',
      payload: { telegramChatId: -100123, telegramUserId: 42 },
      sendAt: new Date(),
    });
    const account = await close(db, leaving);

    expect(await carryAccountClosure(db, account, photos())).toBe(
      'waiting_on_telegram',
    );
    await db
      .update(scheduledNotifications)
      .set({ status: 'sent' })
      .where(eq(scheduledNotifications.userId, leaving));
    expect(await carryAccountClosure(db, account, photos())).toBe('erased');
    expect(await stateOf(db, leaving)).toBe('deleted');
  });

  it("deletes the member's photos from storage along with the rows that name them", async () => {
    const db = await setup();
    const owner = await member(db, 'Rania');
    const asset = await reserveProfileAsset(db, owner, fromNow(24));
    if (!asset) throw new Error('reservation failed');
    const store = photos();
    await store.put(
      `${asset.objectKey}/original`,
      new Uint8Array([1]),
      'image/png',
    );
    await store.put(`${asset.objectKey}/md`, new Uint8Array([2]), 'image/webp');

    expect(await carryAccountClosure(db, await close(db, owner), store)).toBe(
      'erased',
    );
    expect(await store.get(`${asset.objectKey}/original`)).toBeNull();
    expect(await store.get(`${asset.objectKey}/md`)).toBeNull();
  });

  it('carries the other accounts through when one of them fails', async () => {
    const db = await setup();
    const stuck = await member(db, 'Hana');
    const other = await member(db, 'Omar');
    const asset = await reserveProfileAsset(db, stuck, fromNow(24));
    if (!asset) throw new Error('reservation failed');
    await close(db, stuck);
    await close(db, other);
    const store = photos();
    const failing: PhotoStore = {
      put: store.put,
      get: store.get,
      deletePrefix: async (prefix) => {
        if (prefix.startsWith(asset.objectKey)) throw new Error('R2 is down');
        return store.deletePrefix(prefix);
      },
    };

    const tally = await sweepClosingAccounts(db, failing);

    expect(tally.failed).toBeGreaterThanOrEqual(1);
    expect(await stateOf(db, stuck)).toBe('closing');
    expect(await stateOf(db, other)).toBe('deleted');
  });
});
