import { describe, expect, it } from 'vitest';

import {
  countUpcomingByCity,
  countUpcomingByState,
  createEvent,
  listUpcomingEvents,
} from './events.js';
import { baseEvent, nextId, nextSlug, setupDb } from './events.fixtures.js';

const NOW = new Date('2026-06-15T12:00:00Z');
const hours = (n: number) => new Date(NOW.getTime() + n * 60 * 60 * 1000);

const addEvent = async (
  db: Awaited<ReturnType<typeof setupDb>>,
  startsAt: Date,
  endsAt: Date | null,
  scope = 'upcoming-probe',
) => {
  const id = nextId();
  await createEvent(db, {
    ...baseEvent,
    id,
    slug: nextSlug(),
    cityCode: scope,
    stateCode: scope,
    startsAt,
    endsAt,
  });
  return id;
};

const idsFor = async (
  db: Awaited<ReturnType<typeof setupDb>>,
  ids: readonly string[],
) => {
  const rows = await listUpcomingEvents(db, { now: NOW, limit: 200 });
  const listed = new Set(rows.map((row) => row.id));
  return ids.map((id) => listed.has(id));
};

describe('upcoming scope (real D1)', () => {
  it('keeps a meetup that has started but not ended', async () => {
    const db = await setupDb();
    const inProgress = await addEvent(db, hours(-1), hours(1));

    expect(await idsFor(db, [inProgress])).toEqual([true]);
  });

  it('drops a meetup that already ended', async () => {
    const db = await setupDb();
    const finished = await addEvent(db, hours(-5), hours(-3));

    expect(await idsFor(db, [finished])).toEqual([false]);
  });

  it('gives an event with no recorded end two hours before dropping it', async () => {
    const db = await setupDb();
    const withinGrace = await addEvent(db, hours(-1), null);
    const pastGrace = await addEvent(db, hours(-3), null);

    expect(await idsFor(db, [withinGrace, pastGrace])).toEqual([true, false]);
  });

  it('still lists what has not happened yet', async () => {
    const db = await setupDb();
    const future = await addEvent(db, hours(48), hours(50));

    expect(await idsFor(db, [future])).toEqual([true]);
  });

  it('counts a city and a state over the same boundary the list uses', async () => {
    const db = await setupDb();
    const scope = 'counted-probe';
    await addEvent(db, hours(-5), hours(-3), scope);
    await addEvent(db, hours(-1), hours(1), scope);
    await addEvent(db, hours(48), hours(50), scope);

    const listed = (
      await listUpcomingEvents(db, { now: NOW, limit: 200 })
    ).filter((row) => row.cityCode === scope).length;
    const byCity = await countUpcomingByCity(db, 'DZ', NOW);
    const byState = await countUpcomingByState(db, 'DZ', NOW);

    expect(byCity[scope]).toBe(listed);
    expect(byState[scope]).toBe(listed);
    expect(listed).toBe(2);
  });
});
