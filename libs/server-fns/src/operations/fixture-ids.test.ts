import { beforeEach, describe, expect, it } from 'vitest';

import {
  HOST_ID,
  MEMBER_ID,
  OTHER_ID,
  futureEvent,
  pastEvent,
  setupDb,
} from '@founders-coffee/db/operations-fixtures';
import { events, type Db } from '@founders-coffee/db';

import {
  closeoutViewRequestSchema,
  submitCloseoutRequestSchema,
  submitFeedbackRequestSchema,
} from './schemas.js';

const RETIRED_SHAPE = 'evt_ops001';

/** The smallest closeout the boundary accepts, so the id is the only thing under test. */
const closeoutFor = (eventId: string) => ({
  closeout: { eventId, outcome: 'held' as const },
  attendance: [],
});

/** The smallest feedback the boundary accepts, so the id is the only thing under test. */
const feedbackFor = (eventId: string) => ({
  feedback: { eventId, rating: 'valuable' as const, wouldReturn: true },
});

/** How many events the fixture's own people are hosting, whatever their ids look like. */
const fixtureEventCount = async (db: Db): Promise<number> => {
  const rows = await db.select({ hostId: events.hostId }).from(events);
  const owners: string[] = [HOST_ID, MEMBER_ID, OTHER_ID];
  return rows.filter((row) => owners.includes(row.hostId)).length;
};

describe('operations fixtures mint ids the write boundary accepts', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('gives pastEvent an id a closeout submission accepts', async () => {
    const eventId = await pastEvent(db);

    expect(
      submitCloseoutRequestSchema.safeParse(closeoutFor(eventId)).success,
      `pastEvent minted ${eventId}, which submitCloseoutRequestSchema refuses. Every closeout test seeds its event here, so an id this schema rejects makes the whole suite green against input the resolver would never see. Mint it with id('evt') from libs/core (AGENTS.md §6)`,
    ).toBe(true);
  });

  it('gives futureEvent an id a closeout submission accepts', async () => {
    const eventId = await futureEvent(db);

    expect(
      submitCloseoutRequestSchema.safeParse(closeoutFor(eventId)).success,
      `futureEvent minted ${eventId}, which submitCloseoutRequestSchema refuses. The refusal guards read as passing for the wrong reason when the id never reaches them`,
    ).toBe(true);
  });

  it('gives pastEvent an id a feedback submission accepts', async () => {
    const eventId = await pastEvent(db);

    expect(
      submitFeedbackRequestSchema.safeParse(feedbackFor(eventId)).success,
      `pastEvent minted ${eventId}, which submitFeedbackRequestSchema refuses`,
    ).toBe(true);
  });

  it('refuses the counter-shaped id the fixtures used to mint', () => {
    expect(
      submitCloseoutRequestSchema.safeParse(closeoutFor(RETIRED_SHAPE)).success,
      `${RETIRED_SHAPE} now parses. idSchema is ^[a-z]{2,8}_[0-9a-f]{32}$ and this shape has always failed it — if it parses, the boundary was loosened and the three checks above prove nothing`,
    ).toBe(false);
  });

  it('still clears the events it minted, now that their ids spell nothing', async () => {
    await pastEvent(db);
    await futureEvent(db);
    expect(await fixtureEventCount(db)).toBeGreaterThan(0);

    await setupDb();

    expect(
      await fixtureEventCount(db),
      "setupDb left its own events behind. It selects them by host precisely so it keeps working when the ids change; a selector that reads the id — it was once LIKE 'evt_ops%' — matches nothing the moment the fixtures mint through libs/core, and the leak surfaces far away as a unique-constraint failure or an attention query passing on the wrong row",
    ).toBe(0);
  });

  it('shows why reading the closeout could never catch this', () => {
    const view = closeoutViewRequestSchema.safeParse({
      eventId: RETIRED_SHAPE,
    });
    const write = submitCloseoutRequestSchema.safeParse(
      closeoutFor(RETIRED_SHAPE),
    );

    expect(
      view.success && !write.success,
      'The closeout page reads through z.string().min(1) and writes through idSchema. A non-conforming event loads the page and fails only on submit, so a test that renders the page and never submits stays green. That asymmetry is the blind spot this file exists to hold open — if both schemas now agree, delete this test and say so',
    ).toBe(true);
  });
});
