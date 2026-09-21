import { describe, expect, it } from 'vitest';

import { id, idSchema, userIdSchema } from '@founders-coffee/core';

import { accountIds } from './accounts.fixtures.js';
import {
  correctAttendanceSchema,
  recordAttendanceBatchSchema,
  recordAttendanceSchema,
  recordReviewSchema,
  updateHostTrustSchema,
} from './schemas.js';

const REAL_ACCOUNTS = accountIds();

const EVENT = id('evt');

/** Every command that names an account, keyed by the field that carries it. */
const commandsNaming = (userId: string) => [
  {
    name: 'recordAttendanceSchema',
    parse: () =>
      recordAttendanceSchema.safeParse({
        eventId: EVENT,
        userId,
        outcome: 'attended',
      }),
  },
  {
    name: 'recordAttendanceBatchSchema',
    parse: () =>
      recordAttendanceBatchSchema.safeParse({
        eventId: EVENT,
        outcomes: [{ userId, outcome: 'attended' }],
      }),
  },
  {
    name: 'correctAttendanceSchema',
    parse: () =>
      correctAttendanceSchema.safeParse({
        eventId: EVENT,
        userId,
        outcome: 'no_show',
        reason: 'data_entry_error',
      }),
  },
  {
    name: 'updateHostTrustSchema',
    parse: () =>
      updateHostTrustSchema.safeParse({
        marketCode: 'DZ',
        userId,
        status: 'verified',
      }),
  },
  {
    name: 'recordReviewSchema',
    parse: () =>
      recordReviewSchema.safeParse({
        marketCode: 'DZ',
        windowStart: 1,
        windowEnd: 2,
        bottleneck: 'host_supply',
        intervention: 'Recruit two hosts in Hydra',
        ownerUserId: userId,
        dueAt: 3,
      }),
  },
];

describe('the user id contract', () => {
  it('accepts the accounts Better Auth actually minted', () => {
    for (const account of REAL_ACCOUNTS)
      for (const command of commandsNaming(account))
        expect(
          command.parse().success,
          `${command.name} refused ${account}, an id taken from a real account. Better Auth mints user ids and this project does not override advanced.database.generateId, so they are whatever its defaultGenerateId produces — 32 characters of a-zA-Z0-9, with no prefix and no underscore`,
        ).toBe(true);
  });

  it('refuses nothing at all, and refuses more than a page of it', () => {
    for (const rejected of ['', '   ', 'a'.repeat(129)])
      for (const command of commandsNaming(rejected))
        expect(
          command.parse().success,
          `${command.name} accepted ${JSON.stringify(rejected.slice(0, 20))}. The contract asserts no format, so presence and an upper bound are the whole of what it does assert`,
        ).toBe(false);
  });

  it('survives the other id strategies Better Auth can be switched to', () => {
    for (const shape of [
      '550e8400-e29b-41d4-a716-446655440000',
      '1',
      '0193b2a4-7c3e-7000-8000-9f2b1c4d5e6f',
    ])
      for (const command of commandsNaming(shape))
        expect(
          command.parse().success,
          `${command.name} refused ${shape}. advanced.database.generateId also takes 'uuid', 'serial' and a custom function, and ids minted under one setting outlive a change to another — so a format assertion here fails closed on real accounts`,
        ).toBe(true);
  });

  it('is not the entity id format, which every real account fails', () => {
    for (const account of REAL_ACCOUNTS)
      expect(
        idSchema.safeParse(account).success,
        `idSchema accepted ${account}. These five commands validated userId with idSchema until this test was written; if idSchema now accepts an account, the regression it guards can no longer be expressed`,
      ).toBe(false);

    expect(
      userIdSchema.safeParse(id('usr')).success,
      'a usr_-prefixed id should still parse — the contract does not forbid the entity format, it simply does not require it',
    ).toBe(true);
  });
});
