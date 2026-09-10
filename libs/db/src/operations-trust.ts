import { and, desc, eq, gte, lte } from 'drizzle-orm';

import { batch } from './atomic.js';
import type { Db } from './db.js';
import { auditStatement } from './operations-audit.js';
import {
  communityMetricSnapshots,
  hostTrust,
  markets,
  operationsReviews,
  type CommunityMetricSnapshotRow,
  type HostTrustRow,
  type OperationsReviewRow,
} from './schema.js';

/**
 * Set what a market has decided about a host, creating the row on first decision.
 *
 * Upserted on `(market_code, user_id)`, which is what keeps the decision market-local: the same
 * person restricted in Algiers is `unreviewed` in a market that has never looked at them, and
 * §5.19 says that is correct rather than an oversight.
 *
 * `reviewed_by` and `reviewed_at` are set from the actor and the database clock, never from the
 * caller — a trust decision that could be backdated or attributed to someone else is not evidence.
 * The audit entry is in the same batch, guarded on the market existing, so a decision without a
 * trail is unreachable.
 */
export const setHostTrust = async (
  db: Db,
  input: {
    marketCode: string;
    userId: string;
    status: 'unreviewed' | 'verified' | 'restricted';
    reason: string | null;
    actorId: string;
    accessSubject?: string | null;
    rowId: string;
    auditId: string;
  },
): Promise<HostTrustRow | undefined> => {
  const before = await getHostTrust(db, {
    marketCode: input.marketCode,
    userId: input.userId,
  });

  await batch(db, [
    db
      .insert(hostTrust)
      .values({
        id: input.rowId,
        marketCode: input.marketCode,
        userId: input.userId,
        status: input.status,
        reasonCode: input.reason,
        reviewedByUserId: input.actorId,
        reviewedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [hostTrust.marketCode, hostTrust.userId],
        set: {
          status: input.status,
          reasonCode: input.reason,
          reviewedByUserId: input.actorId,
          reviewedAt: new Date(),
          updatedAt: new Date(),
        },
      }),
    auditStatement(
      db,
      {
        id: input.auditId,
        actorUserId: input.actorId,
        accessSubject: input.accessSubject ?? null,
        action: 'host_trust_updated',
        targetType: 'host_trust',
        targetId: input.userId,
        reasonCode: input.reason,
        metadata: {
          before: before?.status ?? 'unreviewed',
          after: input.status,
        },
      },
      markets,
      markets.code,
      eq(markets.code, input.marketCode),
    ),
  ]);

  return getHostTrust(db, {
    marketCode: input.marketCode,
    userId: input.userId,
  });
};

export const getHostTrust = async (
  db: Db,
  opts: { marketCode: string; userId: string },
): Promise<HostTrustRow | undefined> => {
  const rows = await db
    .select()
    .from(hostTrust)
    .where(
      and(
        eq(hostTrust.marketCode, opts.marketCode),
        eq(hostTrust.userId, opts.userId),
      ),
    )
    .limit(1);
  return rows[0];
};

export const listHostsByTrust = (
  db: Db,
  opts: {
    marketCode: string;
    status: 'unreviewed' | 'verified' | 'restricted';
    limit: number;
  },
): Promise<HostTrustRow[]> =>
  db
    .select()
    .from(hostTrust)
    .where(
      and(
        eq(hostTrust.marketCode, opts.marketCode),
        eq(hostTrust.status, opts.status),
      ),
    )
    .orderBy(desc(hostTrust.updatedAt))
    .limit(opts.limit);

/** Write one weekly decision, with the audit entry that says who took it (§5.25). */
export const recordReview = async (
  db: Db,
  input: {
    marketCode: string;
    stateCode: string | null;
    cityCode: string | null;
    windowStart: Date;
    windowEnd: Date;
    bottleneck: string;
    intervention: string;
    ownerUserId: string;
    dueAt: Date;
    actorId: string;
    accessSubject?: string | null;
    rowId: string;
    auditId: string;
  },
): Promise<OperationsReviewRow | undefined> => {
  await batch(db, [
    db.insert(operationsReviews).values({
      id: input.rowId,
      marketCode: input.marketCode,
      stateCode: input.stateCode,
      cityCode: input.cityCode,
      evidenceWindowStart: input.windowStart,
      evidenceWindowEnd: input.windowEnd,
      bottleneck: input.bottleneck,
      intervention: input.intervention,
      ownerUserId: input.ownerUserId,
      dueAt: input.dueAt,
      createdByUserId: input.actorId,
    }),
    auditStatement(
      db,
      {
        id: input.auditId,
        actorUserId: input.actorId,
        accessSubject: input.accessSubject ?? null,
        action: 'review_recorded',
        targetType: 'operations_review',
        targetId: input.rowId,
        reasonCode: null,
        metadata: { bottleneck: input.bottleneck },
      },
      markets,
      markets.code,
      eq(markets.code, input.marketCode),
    ),
  ]);

  const rows = await db
    .select()
    .from(operationsReviews)
    .where(eq(operationsReviews.id, input.rowId))
    .limit(1);
  return rows[0];
};

/** Record what happened to a decision, which is the half of a review that usually goes missing. */
export const recordReviewFollowUp = async (
  db: Db,
  opts: { reviewId: string; result: string },
): Promise<boolean> => {
  const updated = await db
    .update(operationsReviews)
    .set({ followUpResult: opts.result, updatedAt: new Date() })
    .where(eq(operationsReviews.id, opts.reviewId));
  return Boolean((updated as { meta?: { changes?: number } })?.meta?.changes);
};

export const listReviews = (
  db: Db,
  opts: { marketCode: string; since: Date; limit: number },
): Promise<OperationsReviewRow[]> =>
  db
    .select()
    .from(operationsReviews)
    .where(
      and(
        eq(operationsReviews.marketCode, opts.marketCode),
        gte(operationsReviews.evidenceWindowStart, opts.since),
      ),
    )
    .orderBy(desc(operationsReviews.evidenceWindowStart))
    .limit(opts.limit);

/**
 * Write a month's measurement, replacing any earlier answer to the same question.
 *
 * The unique key is the whole identity of the measurement — market, scope, scope code, month,
 * metric — so recomputing August's no-show rate overwrites August's no-show rate and cannot leave
 * two rows disagreeing. §5.21 keeps these indefinitely while the rows behind them are retired at
 * twenty-four months, which only works if each one is authoritative.
 */
export const upsertMetricSnapshot = async (
  db: Db,
  input: {
    marketCode: string;
    scopeType: 'market' | 'state' | 'city';
    scopeCode: string;
    periodMonth: string;
    metricKey: string;
    numerator: number;
    denominator: number | null;
    rowId: string;
  },
): Promise<void> => {
  await db
    .insert(communityMetricSnapshots)
    .values({
      id: input.rowId,
      marketCode: input.marketCode,
      scopeType: input.scopeType,
      scopeCode: input.scopeCode,
      periodMonth: input.periodMonth,
      metricKey: input.metricKey,
      numerator: input.numerator,
      denominator: input.denominator,
      computedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [
        communityMetricSnapshots.marketCode,
        communityMetricSnapshots.scopeType,
        communityMetricSnapshots.scopeCode,
        communityMetricSnapshots.periodMonth,
        communityMetricSnapshots.metricKey,
      ],
      set: {
        numerator: input.numerator,
        denominator: input.denominator,
        computedAt: new Date(),
      },
    });
};

export const listMetricSnapshots = (
  db: Db,
  opts: {
    marketCode: string;
    scopeType: 'market' | 'state' | 'city';
    scopeCode: string;
    fromMonth: string;
    toMonth: string;
  },
): Promise<CommunityMetricSnapshotRow[]> =>
  db
    .select()
    .from(communityMetricSnapshots)
    .where(
      and(
        eq(communityMetricSnapshots.marketCode, opts.marketCode),
        eq(communityMetricSnapshots.scopeType, opts.scopeType),
        eq(communityMetricSnapshots.scopeCode, opts.scopeCode),
        gte(communityMetricSnapshots.periodMonth, opts.fromMonth),
        lte(communityMetricSnapshots.periodMonth, opts.toMonth),
      ),
    )
    .orderBy(communityMetricSnapshots.periodMonth);
