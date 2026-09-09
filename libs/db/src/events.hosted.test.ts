import { describe, expect, it } from 'vitest';

import {
  countHostedEvents,
  createEvent,
  listHostedEvents,
  transitionEventStatus,
} from './events.js';
import {
  OTHER_HOST_ID,
  TEST_HOST_ID,
  baseEvent,
  nextId,
  nextSlug,
  setupDb,
} from './events.fixtures.js';

const HOST = TEST_HOST_ID;

const hostEvent = async (
  db: Awaited<ReturnType<typeof setupDb>>,
  startsAt: Date,
  overrides: Record<string, unknown> = {},
) => {
  const id = nextId();
  await createEvent(db, {
    ...baseEvent,
    id,
    slug: nextSlug(),
    hostId: HOST,
    startsAt,
    ...overrides,
  });
  return id;
};

describe('hosted event history (real D1)', () => {
  it('returns the newest first and pages past it without skipping a shared start', async () => {
    const db = await setupDb();
    const older = await hostEvent(db, new Date('2026-01-01T18:00:00Z'));
    const tieA = await hostEvent(db, new Date('2026-05-01T18:00:00Z'));
    const tieB = await hostEvent(db, new Date('2026-05-01T18:00:00Z'));
    const newest = await hostEvent(db, new Date('2026-09-01T18:00:00Z'));

    const first = await listHostedEvents(db, { hostId: HOST, limit: 2 });
    expect(first.map((row) => row.id)).toEqual([
      newest,
      [tieA, tieB].sort().reverse()[0],
    ]);

    const last = first[first.length - 1];
    const second = await listHostedEvents(db, {
      hostId: HOST,
      limit: 2,
      beforeStartsAt: last.startsAt,
      beforeId: last.id,
    });

    const seen = [...first, ...second].map((row) => row.id);
    expect(new Set(seen).size).toBe(seen.length);
    expect(seen).toContain(older);
    expect(seen).toContain(tieA);
    expect(seen).toContain(tieB);
  });

  it('counts exactly the rows the list pages through', async () => {
    const db = await setupDb();
    await hostEvent(db, new Date('2026-02-01T18:00:00Z'));
    await hostEvent(db, new Date('2026-03-01T18:00:00Z'));
    await hostEvent(db, new Date('2026-04-01T18:00:00Z'));

    const total = await countHostedEvents(db, { hostId: HOST });
    const all = await listHostedEvents(db, { hostId: HOST, limit: 200 });

    expect(total).toBe(all.length);
    expect(total).toBeGreaterThanOrEqual(3);
  });

  it('leaves a cancelled event out of both the list and the count', async () => {
    const db = await setupDb();
    await hostEvent(db, new Date('2026-02-01T18:00:00Z'));
    const cancelled = await hostEvent(db, new Date('2026-03-01T18:00:00Z'));
    await transitionEventStatus(db, cancelled, 'published', 'cancelled');

    const listed = await listHostedEvents(db, { hostId: HOST, limit: 200 });
    expect(listed.map((row) => row.id)).not.toContain(cancelled);
    expect(await countHostedEvents(db, { hostId: HOST })).toBe(listed.length);
  });

  it("never counts or lists another host's events", async () => {
    const db = await setupDb();
    await hostEvent(db, new Date('2026-02-01T18:00:00Z'));
    await createEvent(db, {
      ...baseEvent,
      id: nextId(),
      slug: nextSlug(),
      hostId: OTHER_HOST_ID,
      startsAt: new Date('2026-06-01T18:00:00Z'),
    });

    const listed = await listHostedEvents(db, { hostId: HOST, limit: 200 });
    expect(listed.every((row) => row.hostId === HOST)).toBe(true);
    expect(await countHostedEvents(db, { hostId: HOST })).toBe(listed.length);
    expect(await countHostedEvents(db, { hostId: OTHER_HOST_ID })).toBe(
      (await listHostedEvents(db, { hostId: OTHER_HOST_ID, limit: 200 }))
        .length,
    );
  });

  it('scopes both to one market when asked', async () => {
    const db = await setupDb();
    await hostEvent(db, new Date('2026-02-01T18:00:00Z'));

    const inMarket = await listHostedEvents(db, {
      hostId: HOST,
      marketCode: 'DZ',
      limit: 200,
    });
    expect(
      await countHostedEvents(db, { hostId: HOST, marketCode: 'DZ' }),
    ).toBe(inMarket.length);
    expect(
      await countHostedEvents(db, { hostId: HOST, marketCode: 'EG' }),
    ).toBe(0);
    expect(
      await listHostedEvents(db, { hostId: HOST, marketCode: 'EG', limit: 50 }),
    ).toEqual([]);
  });
});
