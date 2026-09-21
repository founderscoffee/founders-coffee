import { beforeEach, describe, expect, it } from 'vitest';

import {
  HOST_ID,
  MEMBER_ID,
  OTHER_ID,
  futureEvent,
  pastEvent,
  setupDb,
} from '@founders-coffee/db/operations-fixtures';
import type { Db } from '@founders-coffee/db';

import { cancelEventResolver } from './events/cancel.js';
import {
  operationMatrix,
  type Actor,
  type Phase,
} from './operations-matrix.js';

const MATRIX = operationMatrix();

const ACTORS: Record<Actor, string> = {
  host: HOST_ID,
  attendee: MEMBER_ID,
  stranger: OTHER_ID,
};

const PHASES: Record<Phase, (db: Db) => Promise<string>> = {
  before_start: (db) => futureEvent(db, { attendees: [MEMBER_ID] }),
  in_progress: (db) =>
    pastEvent(db, { endedHoursAgo: -1, attendees: [MEMBER_ID] }),
  after_end: (db) =>
    pastEvent(db, { endedHoursAgo: 2, attendees: [MEMBER_ID] }),
  no_end: (db) => pastEvent(db, { withEndsAt: false, attendees: [MEMBER_ID] }),
  cancelled: (db) =>
    pastEvent(db, {
      endedHoursAgo: 2,
      status: 'cancelled',
      attendees: [MEMBER_ID],
    }),
};

const OPERATIONS = {
  cancelEvent: (db: Db, eventId: string, actorId: string) =>
    cancelEventResolver(db, { eventId, actorId }),
};

/** What actually happened, in the vocabulary the table uses. */
const outcomeOf = async (
  run: () => Promise<{ ok: boolean; error?: { code: string } }>,
): Promise<string> => {
  const result = await run();
  return result.ok ? 'ok' : (result.error?.code ?? 'unknown_error');
};

describe('the operations matrix', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  for (const [operation, phases] of Object.entries(MATRIX))
    for (const [phase, actors] of Object.entries(phases))
      for (const [actor, expected] of Object.entries(actors))
        it(`${operation}: ${actor} ${phase} → ${expected}`, async () => {
          const eventId = await PHASES[phase as Phase](db);

          const outcome = await outcomeOf(() =>
            OPERATIONS[operation as keyof typeof OPERATIONS](
              db,
              eventId,
              ACTORS[actor as Actor],
            ),
          );

          expect(
            outcome,
            `operations-matrix.ts says ${actor} calling ${operation} on an event ${phase.replace('_', ' ')} gets ${expected}, and it got ${outcome}. Either the guard changed or the table is stating something the server does not do — one of the two is wrong, and the table is the reviewed one`,
          ).toBe(expected);
        });

  it('covers every operation the matrix declares', () => {
    expect(
      Object.keys(MATRIX).sort(),
      'an operation named in the table has no runner here, so its row is decorative',
    ).toEqual(Object.keys(OPERATIONS).sort());
  });

  it('states an outcome for every phase and actor', () => {
    for (const [operation, phases] of Object.entries(MATRIX)) {
      expect(
        Object.keys(phases).sort(),
        `${operation} leaves a lifecycle phase unstated. A phase nobody wrote down is a phase nobody decided`,
      ).toEqual(Object.keys(PHASES).sort());

      for (const [phase, actors] of Object.entries(phases))
        expect(
          Object.keys(actors).sort(),
          `${operation}/${phase} leaves an actor unstated`,
        ).toEqual(Object.keys(ACTORS).sort());
    }
  });
});
