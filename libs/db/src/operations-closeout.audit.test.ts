import { beforeEach, describe, expect, it } from 'vitest';

import { submitCloseout } from './operations-closeout.js';
import {
  HOST_ID,
  auditRows,
  pastEvent,
  setupDb,
} from './operations.fixtures.js';
import type { Db } from './db.js';

const submit = (db: Db, eventId: string, n: number) =>
  submitCloseout(db, {
    eventId,
    actorId: HOST_ID,
    outcome: 'held',
    walkInCount: 0,
    wouldHostAgain: null,
    hostFriction: [],
    auditId: `aud_dup_${n}`,
  });

describe('the trail a repeated submission leaves', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('records the submission once, however many times it is retried', async () => {
    const eventId = await pastEvent(db);

    const outcomes = [
      (await submit(db, eventId, 1)).outcome,
      (await submit(db, eventId, 2)).outcome,
      (await submit(db, eventId, 3)).outcome,
    ];

    expect(outcomes).toEqual(['submitted', 'already_closed', 'already_closed']);
    const submitted = (await auditRows(db)).filter(
      (row) => row.action === 'closeout_submitted',
    );
    expect(submitted).toHaveLength(1);
  });

  it('never records an outcome the stored closeout does not have', async () => {
    const eventId = await pastEvent(db);
    await submit(db, eventId, 1);

    await submitCloseout(db, {
      eventId,
      actorId: HOST_ID,
      outcome: 'did_not_happen',
      walkInCount: 0,
      wouldHostAgain: null,
      hostFriction: [],
      auditId: 'aud_dup_9',
    });

    const outcomes = (await auditRows(db))
      .filter((row) => row.action === 'closeout_submitted')
      .map((row) => (row.metadata as { outcome?: string }).outcome);
    expect(outcomes).toEqual(['held']);
  });
});
