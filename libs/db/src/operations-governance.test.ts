import { beforeEach, describe, expect, it } from 'vitest';
import { eq, sql } from 'drizzle-orm';

import { id } from '@founders-coffee/core';

import type { Db } from './db.js';
import { communityOperationsEnabled } from './operations-flag.js';
import {
  getHostTrust,
  listHostsByTrust,
  listMetricSnapshots,
  listReviews,
  recordReview,
  recordReviewFollowUp,
  setHostTrust,
  upsertMetricSnapshot,
} from './operations-trust.js';
import { markets } from './schema.js';
import {
  HOST_ID,
  OTHER_ID,
  auditRows,
  setupDb,
} from './operations.fixtures.js';

describe('communityOperationsEnabled', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('is enabled for the DZ launch market', async () => {
    expect(await communityOperationsEnabled(db, 'DZ')).toBe(true);
  });

  it('is on once the market flag is set', async () => {
    await db
      .update(markets)
      .set({
        featureFlags: {
          events: true,
          hackathons: false,
          payments: false,
          recruiting: false,
          communityOperations: true,
        },
      })
      .where(eq(markets.code, 'DZ'));

    expect(await communityOperationsEnabled(db, 'DZ')).toBe(true);
  });

  it('resolves an absent key to off rather than to undefined', async () => {
    await db.run(
      sql`UPDATE markets
          SET feature_flags = '{"events":true,"hackathons":false,"payments":false,"recruiting":false}'
          WHERE code = 'DZ'`,
    );

    expect(await communityOperationsEnabled(db, 'DZ')).toBe(false);
  });

  it('resolves a non-boolean value to off', async () => {
    await db.run(
      sql`UPDATE markets
          SET feature_flags = '{"events":true,"hackathons":false,"payments":false,"recruiting":false,"communityOperations":"yes"}'
          WHERE code = 'DZ'`,
    );

    expect(await communityOperationsEnabled(db, 'DZ')).toBe(false);
  });

  it('resolves an unknown market to off', async () => {
    expect(await communityOperationsEnabled(db, 'ZZ')).toBe(false);
  });
});

describe('host trust', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('records a decision with who took it', async () => {
    const row = await setHostTrust(db, {
      marketCode: 'DZ',
      userId: HOST_ID,
      status: 'verified',
      reason: null,
      actorId: OTHER_ID,
      rowId: id('trs'),
      auditId: id('aud'),
    });

    expect(row).toMatchObject({
      status: 'verified',
      reviewedByUserId: OTHER_ID,
    });
  });

  it('updates the same row rather than adding a second decision', async () => {
    await setHostTrust(db, {
      marketCode: 'DZ',
      userId: HOST_ID,
      status: 'verified',
      reason: null,
      actorId: OTHER_ID,
      rowId: id('trs'),
      auditId: id('aud'),
    });

    await setHostTrust(db, {
      marketCode: 'DZ',
      userId: HOST_ID,
      status: 'restricted',
      reason: 'safety',
      actorId: OTHER_ID,
      rowId: id('trs'),
      auditId: id('aud'),
    });

    expect(
      await listHostsByTrust(db, {
        marketCode: 'DZ',
        status: 'restricted',
        limit: 10,
      }),
    ).toHaveLength(1);
    expect(
      await listHostsByTrust(db, {
        marketCode: 'DZ',
        status: 'verified',
        limit: 10,
      }),
    ).toEqual([]);
  });

  it('keeps a decision inside the market that took it', async () => {
    await setHostTrust(db, {
      marketCode: 'DZ',
      userId: HOST_ID,
      status: 'restricted',
      reason: 'policy',
      actorId: OTHER_ID,
      rowId: id('trs'),
      auditId: id('aud'),
    });

    expect(
      await getHostTrust(db, { marketCode: 'EG', userId: HOST_ID }),
    ).toBeUndefined();
  });

  it('records the transition in the audit with its reason', async () => {
    await setHostTrust(db, {
      marketCode: 'DZ',
      userId: HOST_ID,
      status: 'restricted',
      reason: 'safety',
      actorId: OTHER_ID,
      accessSubject: 'access-1',
      rowId: id('trs'),
      auditId: id('aud'),
    });

    expect((await auditRows(db))[0]).toMatchObject({
      action: 'host_trust_updated',
      reasonCode: 'safety',
      accessSubject: 'access-1',
      metadata: { before: 'unreviewed', after: 'restricted' },
    });
  });
});

describe('weekly reviews and metric snapshots', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('records a decision and the window it came from', async () => {
    const reviewId = id('rev');
    const row = await recordReview(db, {
      marketCode: 'DZ',
      stateCode: null,
      cityCode: null,
      windowStart: new Date('2026-09-01T00:00:00Z'),
      windowEnd: new Date('2026-09-07T00:00:00Z'),
      bottleneck: 'host_supply',
      intervention: 'Ask two past hosts to run September',
      ownerUserId: HOST_ID,
      dueAt: new Date('2026-09-14T00:00:00Z'),
      actorId: OTHER_ID,
      rowId: reviewId,
      auditId: id('aud'),
    });

    expect(row).toMatchObject({ bottleneck: 'host_supply' });
    expect(
      await listReviews(db, {
        marketCode: 'DZ',
        since: new Date('2026-08-01T00:00:00Z'),
        limit: 10,
      }),
    ).toHaveLength(1);
  });

  it('records what became of the decision', async () => {
    const reviewId = id('rev');
    await recordReview(db, {
      marketCode: 'DZ',
      stateCode: null,
      cityCode: null,
      windowStart: new Date('2026-09-01T00:00:00Z'),
      windowEnd: new Date('2026-09-07T00:00:00Z'),
      bottleneck: 'discovery',
      intervention: 'Post the September calendar on Monday',
      ownerUserId: HOST_ID,
      dueAt: new Date('2026-09-14T00:00:00Z'),
      actorId: OTHER_ID,
      rowId: reviewId,
      auditId: id('aud'),
    });

    expect(await recordReviewFollowUp(db, { reviewId, result: 'Done' })).toBe(
      true,
    );
  });

  it('overwrites a month rather than accumulating answers for it', async () => {
    const snapshot = {
      marketCode: 'DZ',
      scopeType: 'market' as const,
      scopeCode: 'DZ',
      periodMonth: '2026-09',
      metricKey: 'completed_events',
      denominator: null,
    };

    await upsertMetricSnapshot(db, {
      ...snapshot,
      numerator: 5,
      rowId: id('snp'),
    });
    await upsertMetricSnapshot(db, {
      ...snapshot,
      numerator: 8,
      rowId: id('snp'),
    });

    const rows = await listMetricSnapshots(db, {
      ...snapshot,
      fromMonth: '2026-01',
      toMonth: '2026-12',
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]?.numerator).toBe(8);
  });
});
