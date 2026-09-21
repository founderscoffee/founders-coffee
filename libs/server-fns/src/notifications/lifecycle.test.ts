import { beforeEach, describe, expect, it } from 'vitest';

import {
  HOST_ID,
  MEMBER_ID,
  enableOperations,
  futureEvent,
  pastEvent,
  setupDb,
} from '@founders-coffee/db/operations-fixtures';
import type { NotificationTemplateKey } from '@founders-coffee/core';
import { eq, scheduledNotifications, type Db } from '@founders-coffee/db';

import { cancelEventResolver } from '../events/cancel.js';
import { submitCloseoutResolver } from '../operations/closeout.js';

type Transition = {
  readonly name: string;
  readonly seed: (db: Db) => Promise<string>;
  readonly run: (db: Db, eventId: string) => Promise<unknown>;
  readonly drops: readonly NotificationTemplateKey[];
  readonly keeps: readonly NotificationTemplateKey[];
  readonly open?: Readonly<Record<string, string>>;
};

const TRANSITIONS: readonly Transition[] = [
  {
    name: 'cancelling a gathering',
    seed: (db) => futureEvent(db, { attendees: [MEMBER_ID] }),
    run: (db, eventId) =>
      cancelEventResolver(db, { eventId, actorId: HOST_ID }),
    drops: [
      'reminder_72h',
      'reminder_24h',
      'closeout_prompt',
      'feedback_invitation',
    ],
    keeps: [],
  },
  {
    name: 'closing a gathering out',
    seed: (db) => pastEvent(db, { attendees: [MEMBER_ID] }),
    run: (db, eventId) =>
      submitCloseoutResolver(db, {
        actorId: HOST_ID,
        input: {
          eventId,
          outcome: 'held',
          walkInCount: 0,
          wouldHostAgain: null,
          hostFriction: [],
        },
        attendance: [],
      }),
    drops: ['closeout_prompt'],
    keeps: ['feedback_invitation'],
  },
];

const seedId = (key: string) => `ntf_seed_${key}`;

/**
 * Leave one pending notification of each key the transition has an opinion about.
 *
 * Inserted rather than produced. How the row got there is the producers' business and each has its
 * own suite; what this asks is only what survives the transition, and driving five producers to
 * find out would make the answer depend on five channel plans and five sets of contact preferences.
 */
const seedNotifications = async (
  db: Db,
  eventId: string,
  keys: readonly NotificationTemplateKey[],
) => {
  for (const key of keys)
    await db.insert(scheduledNotifications).values({
      id: seedId(key),
      eventId,
      userId: HOST_ID,
      channel: 'email',
      status: 'pending',
      templateKey: key,
      payload: {},
      sendAt: new Date(),
    });
};

const statusOf = async (db: Db, key: string) => {
  const rows = await db
    .select({ status: scheduledNotifications.status })
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.id, seedId(key)))
    .limit(1);
  return rows[0]?.status;
};

describe('what a terminal transition does to the messages still queued behind it', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
    await enableOperations(db);
  });

  it('declares both halves for every transition, and an issue for anything left open', () => {
    for (const transition of TRANSITIONS) {
      expect(
        transition.drops.length,
        `${transition.name} retires nothing, which makes the entry pointless`,
      ).toBeGreaterThan(0);
      for (const [key, why] of Object.entries(transition.open ?? {})) {
        expect(
          transition.drops,
          `${transition.name}: ${key} is marked open but is not something this transition claims to retire`,
        ).toContain(key);
        expect(
          why,
          `${transition.name}: ${key} is parked without an issue to close it against`,
        ).toMatch(/#\d+/u);
      }
    }
  });

  for (const transition of TRANSITIONS) {
    describe(transition.name, () => {
      it('retires the messages its own outcome contradicts', async () => {
        const eventId = await transition.seed(db);
        await seedNotifications(db, eventId, transition.drops);

        await transition.run(db, eventId);

        for (const key of transition.drops) {
          if (key in (transition.open ?? {})) continue;
          expect(
            await statusOf(db, key),
            `${key} is still pending after ${transition.name}, so it will reach somebody it contradicts`,
          ).not.toBe('pending');
        }
      });

      /**
       * The half that keeps the obvious fix from breaking something else.
       *
       * Retiring is done with `cancelNotificationsByEvent`, which takes every pending row for the
       * event — so a transition that also enqueues its own messages has to cancel before it writes,
       * not after. `submitCloseoutResolver` writes the feedback invitations, and the natural fix for
       * #80 put in the natural place would retire the ones it had just created.
       */
      it('leaves alone the messages it does not contradict', async () => {
        const eventId = await transition.seed(db);
        await seedNotifications(db, eventId, transition.keeps);

        await transition.run(db, eventId);

        for (const key of transition.keeps)
          expect(
            await statusOf(db, key),
            `${key} was retired by ${transition.name}, which had no quarrel with it`,
          ).toBe('pending');
      });

      it('has no parked defect that has quietly been fixed', async () => {
        const parked = Object.keys(transition.open ?? {});
        if (parked.length === 0) return;

        const eventId = await transition.seed(db);
        await seedNotifications(
          db,
          eventId,
          parked as NotificationTemplateKey[],
        );

        await transition.run(db, eventId);

        for (const key of parked)
          expect(
            await statusOf(db, key),
            `${key} is parked as open on ${transition.name} but is now being retired — delete the entry so the assertion takes over`,
          ).toBe('pending');
      });
    });
  }
});
