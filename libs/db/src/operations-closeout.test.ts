import { beforeEach, describe, expect, it } from 'vitest';

import { id } from '@founders-coffee/core';

import {
  correctCloseout,
  getCloseout,
  submitCloseout,
} from './operations-closeout.js';
import {
  HOST_ID,
  OTHER_ID,
  auditRows,
  futureEvent,
  pastEvent,
  setupDb,
} from './operations.fixtures.js';
import type { Db } from './db.js';

const submit = (
  db: Db,
  eventId: string,
  overrides: Partial<Parameters<typeof submitCloseout>[1]> = {},
) =>
  submitCloseout(db, {
    eventId,
    actorId: HOST_ID,
    outcome: 'held',
    walkInCount: 0,
    wouldHostAgain: null,
    hostFriction: [],
    auditId: id('aud'),
    ...overrides,
  });

describe('submitCloseout', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('records what happened once the event is over', async () => {
    const eventId = await pastEvent(db);

    const result = await submit(db, eventId, {
      outcome: 'held',
      walkInCount: 3,
      wouldHostAgain: true,
      hostFriction: ['venue'],
    });

    expect(result.outcome).toBe('submitted');
    expect(result.row).toMatchObject({
      outcome: 'held',
      walkInCount: 3,
      wouldHostAgain: true,
      version: 0,
    });
  });

  it('copies the geography from the event rather than trusting a caller', async () => {
    const eventId = await pastEvent(db);

    await submit(db, eventId);

    expect(await getCloseout(db, eventId)).toMatchObject({
      marketCode: 'DZ',
      stateCode: '16',
      cityCode: '1',
    });
  });

  it('refuses a caller who does not host the event', async () => {
    const eventId = await pastEvent(db);

    const result = await submit(db, eventId, { actorId: OTHER_ID });

    expect(result.outcome).toBe('not_host');
    expect(await getCloseout(db, eventId)).toBeUndefined();
  });

  it('refuses an event that has not finished', async () => {
    const eventId = await futureEvent(db);

    expect((await submit(db, eventId)).outcome).toBe('not_ended');
  });

  it('refuses a cancelled event, whose status already says what happened', async () => {
    const eventId = await pastEvent(db, { status: 'cancelled' });

    expect((await submit(db, eventId)).outcome).toBe('event_cancelled');
  });

  it('refuses a legacy event with no end time rather than inferring one', async () => {
    const eventId = await pastEvent(db, { withEndsAt: false });

    const result = await submit(db, eventId);

    expect(result.outcome).toBe('no_end_time');
    expect(await getCloseout(db, eventId)).toBeUndefined();
  });

  it('is idempotent, so a double submit records one outcome', async () => {
    const eventId = await pastEvent(db);
    await submit(db, eventId, { outcome: 'held' });

    const second = await submit(db, eventId, { outcome: 'did_not_happen' });

    expect(second.outcome).toBe('already_closed');
    expect((await getCloseout(db, eventId))?.outcome).toBe('held');
  });

  it('writes the audit entry in the same batch as the outcome', async () => {
    const eventId = await pastEvent(db);

    await submit(db, eventId);

    const audit = await auditRows(db);
    expect(audit).toHaveLength(1);
    expect(audit[0]).toMatchObject({
      action: 'closeout_submitted',
      targetType: 'closeout',
      targetId: eventId,
      marketCode: 'DZ',
    });
  });

  it('writes no audit entry for a closeout it refused', async () => {
    const eventId = await pastEvent(db, { status: 'cancelled' });

    await submit(db, eventId);

    expect(await auditRows(db)).toEqual([]);
  });
});

describe('correctCloseout', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('changes the outcome and bumps the version', async () => {
    const eventId = await pastEvent(db);
    await submit(db, eventId, { outcome: 'held' });

    const result = await correctCloseout(db, {
      eventId,
      expectedVersion: 0,
      actorId: OTHER_ID,
      outcome: 'did_not_happen',
      walkInCount: 0,
      wouldHostAgain: null,
      hostFriction: [],
      reason: 'data_entry_error',
      auditId: id('aud'),
    });

    expect(result.outcome).toBe('corrected');
    expect(result.row).toMatchObject({ outcome: 'did_not_happen', version: 1 });
  });

  it('refuses the second of two corrections racing the same version', async () => {
    const eventId = await pastEvent(db);
    await submit(db, eventId);
    const correction = {
      eventId,
      expectedVersion: 0,
      actorId: OTHER_ID,
      outcome: 'did_not_happen' as const,
      walkInCount: 0,
      wouldHostAgain: null,
      hostFriction: [],
      reason: 'data_entry_error',
    };

    await correctCloseout(db, { ...correction, auditId: id('aud') });
    const stale = await correctCloseout(db, {
      ...correction,
      outcome: 'held',
      auditId: id('aud'),
    });

    expect(stale.outcome).toBe('stale_version');
    expect((await getCloseout(db, eventId))?.outcome).toBe('did_not_happen');
  });

  it('reports a closeout that was never submitted', async () => {
    const eventId = await pastEvent(db);

    const result = await correctCloseout(db, {
      eventId,
      expectedVersion: 0,
      actorId: OTHER_ID,
      outcome: 'held',
      walkInCount: 0,
      wouldHostAgain: null,
      hostFriction: [],
      reason: 'data_entry_error',
      auditId: id('aud'),
    });

    expect(result.outcome).toBe('not_closed');
  });

  it('records the before and after in the audit, with the reason', async () => {
    const eventId = await pastEvent(db);
    await submit(db, eventId, { outcome: 'held' });

    await correctCloseout(db, {
      eventId,
      expectedVersion: 0,
      actorId: OTHER_ID,
      accessSubject: 'access-subject-1',
      outcome: 'did_not_happen',
      walkInCount: 0,
      wouldHostAgain: null,
      hostFriction: [],
      reason: 'host_request',
      auditId: id('aud'),
    });

    const correction = (await auditRows(db)).find(
      (row) => row.action === 'closeout_corrected',
    );
    expect(correction).toMatchObject({
      reasonCode: 'host_request',
      accessSubject: 'access-subject-1',
      metadata: { before: 'held', after: 'did_not_happen' },
    });
  });

  it('writes no audit entry for a correction it refused', async () => {
    const eventId = await pastEvent(db);
    await submit(db, eventId);

    await correctCloseout(db, {
      eventId,
      expectedVersion: 9,
      actorId: OTHER_ID,
      outcome: 'held',
      walkInCount: 0,
      wouldHostAgain: null,
      hostFriction: [],
      reason: 'data_entry_error',
      auditId: id('aud'),
    });

    const corrections = (await auditRows(db)).filter(
      (row) => row.action === 'closeout_corrected',
    );
    expect(corrections).toEqual([]);
  });
});
