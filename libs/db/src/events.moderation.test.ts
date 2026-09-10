import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import {
  countHostedEvents,
  countUpcomingByCity,
  createEvent,
  listHostedEvents,
  listUpcomingEvents,
} from './events.js';
import { isVisibleIdentity } from './member-profiles.js';
import { user } from './schema.js';
import {
  OTHER_HOST_ID,
  baseEvent,
  nextId,
  nextSlug,
  setupDb,
} from './events.fixtures.js';

const NOW = new Date('2026-06-15T12:00:00Z');
const SOON = new Date('2026-06-20T18:00:00Z');

const suppress = (
  db: Awaited<ReturnType<typeof setupDb>>,
  change: { banned?: boolean; accountState?: string },
) => db.update(user).set(change).where(eq(user.id, OTHER_HOST_ID)).run();

const restore = (db: Awaited<ReturnType<typeof setupDb>>) =>
  suppress(db, { banned: false, accountState: 'active' });

const hostedByOther = async (
  db: Awaited<ReturnType<typeof setupDb>>,
  scope: string,
) => {
  const id = nextId();
  await createEvent(db, {
    ...baseEvent,
    id,
    slug: nextSlug(),
    hostId: OTHER_HOST_ID,
    cityCode: scope,
    stateCode: scope,
    startsAt: SOON,
  });
  return id;
};

const visibleIds = async (db: Awaited<ReturnType<typeof setupDb>>) =>
  new Set(
    (await listUpcomingEvents(db, { now: NOW, limit: 200 })).map(
      (row) => row.id,
    ),
  );

describe('suppressed hosts (real D1)', () => {
  it('keeps an active host visible everywhere', async () => {
    const db = await setupDb();
    await restore(db);
    const id = await hostedByOther(db, 'moderation-active');

    expect(await isVisibleIdentity(db, OTHER_HOST_ID)).toBe(true);
    expect(await visibleIds(db)).toContain(id);
    expect(
      await countHostedEvents(db, { hostId: OTHER_HOST_ID }),
    ).toBeGreaterThan(0);
  });

  it('treats a host who has never been moderated as visible', async () => {
    const db = await setupDb();
    await db
      .update(user)
      .set({ banned: null, accountState: 'active' })
      .where(eq(user.id, OTHER_HOST_ID))
      .run();
    const id = await hostedByOther(db, 'moderation-untouched');

    expect(await isVisibleIdentity(db, OTHER_HOST_ID)).toBe(true);
    expect(await visibleIds(db)).toContain(id);
    expect(
      await listHostedEvents(db, { hostId: OTHER_HOST_ID, limit: 200 }),
    ).not.toEqual([]);
    await restore(db);
  });

  it.each([
    ['banned', { banned: true }],
    ['closing an account', { accountState: 'closing' }],
    ['deleting an account', { accountState: 'deleted' }],
  ])(
    'withdraws the feed, the history and the counts when %s',
    async (_label, change) => {
      const db = await setupDb();
      await restore(db);
      const scope = `moderation-${String(change.accountState ?? 'banned')}`;
      const id = await hostedByOther(db, scope);
      expect(await visibleIds(db)).toContain(id);

      await suppress(db, change);

      expect(await isVisibleIdentity(db, OTHER_HOST_ID)).toBe(false);
      expect(await visibleIds(db)).not.toContain(id);
      expect(
        await listHostedEvents(db, { hostId: OTHER_HOST_ID, limit: 200 }),
      ).toEqual([]);
      expect(await countHostedEvents(db, { hostId: OTHER_HOST_ID })).toBe(0);
      expect((await countUpcomingByCity(db, 'DZ', NOW))[scope]).toBeUndefined();

      await restore(db);
    },
  );

  it('leaves every other host untouched by one suppression', async () => {
    const db = await setupDb();
    await restore(db);
    const mine = nextId();
    await createEvent(db, {
      ...baseEvent,
      id: mine,
      slug: nextSlug(),
      cityCode: 'moderation-bystander',
      stateCode: 'moderation-bystander',
      startsAt: SOON,
    });

    await suppress(db, { banned: true });
    expect(await visibleIds(db)).toContain(mine);
    await restore(db);
  });
});
