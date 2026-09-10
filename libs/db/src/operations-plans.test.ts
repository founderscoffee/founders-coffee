import { beforeEach, describe, expect, it } from 'vitest';
import { sql } from 'drizzle-orm';

import type { Db } from './db.js';
import { setupDb } from './operations.fixtures.js';

/**
 * The plan D1 chooses for a query, as one readable line.
 *
 * CO-03's verification bar asks for the dashboard hot paths to be inspected rather than assumed,
 * because an index that exists and an index that is used are different facts and only the second
 * one matters when a market has two years of attendance in it.
 */
const planFor = async (db: Db, query: string): Promise<string> => {
  const rows = await db.all<{ detail: string }>(
    sql.raw(`EXPLAIN QUERY PLAN ${query}`),
  );
  return rows.map((row) => row.detail).join(' | ');
};

describe('the dashboard hot paths use their indexes', () => {
  let db: Db;

  beforeEach(async () => {
    db = await setupDb();
  });

  it('finds overdue closeouts by market and end time', async () => {
    const plan = await planFor(
      db,
      `SELECT e.id FROM events e
       LEFT JOIN event_closeouts c ON c.event_id = e.id
       WHERE e.market_code = 'DZ' AND e.ends_at < 0 AND c.event_id IS NULL`,
    );

    expect(plan).toMatch(/USING (COVERING )?INDEX|SEARCH/);
    expect(plan).not.toMatch(/SCAN event_closeouts(?! USING)/);
  });

  it("finds one member's attendance without scanning the table", async () => {
    const plan = await planFor(
      db,
      `SELECT id FROM event_attendance WHERE user_id = 'usr_x' ORDER BY recorded_at`,
    );

    expect(plan).toMatch(/event_attendance_user_index/);
  });

  it("finds one event's attendance by the unique pair", async () => {
    const plan = await planFor(
      db,
      `SELECT id FROM event_attendance WHERE event_id = 'evt_x' AND user_id = 'usr_x'`,
    );

    expect(plan).toMatch(/event_attendance_event_user_unique/);
  });

  it("finds an event's feedback by event", async () => {
    const plan = await planFor(
      db,
      `SELECT id FROM event_feedback WHERE event_id = 'evt_x'`,
    );

    expect(plan).toMatch(/event_feedback_event/);
  });

  it('finds hosts by trust status inside one market', async () => {
    const plan = await planFor(
      db,
      `SELECT id FROM host_trust WHERE market_code = 'DZ' AND status = 'restricted'`,
    );

    expect(plan).toMatch(/host_trust_(status|market_user)/);
  });

  it('finds the audit for one target without scanning the stream', async () => {
    const plan = await planFor(
      db,
      `SELECT id FROM operations_audit
       WHERE target_type = 'closeout' AND target_id = 'evt_x'
       ORDER BY created_at DESC`,
    );

    expect(plan).toMatch(/operations_audit_target_index/);
  });

  it("finds a market's audit window by time", async () => {
    const plan = await planFor(
      db,
      `SELECT id FROM operations_audit
       WHERE market_code = 'DZ' AND created_at >= 0
       ORDER BY created_at DESC`,
    );

    expect(plan).toMatch(/operations_audit_market_time_index/);
  });

  it("finds a market's reviews by window", async () => {
    const plan = await planFor(
      db,
      `SELECT id FROM operations_reviews
       WHERE market_code = 'DZ' AND evidence_window_start >= 0`,
    );

    expect(plan).toMatch(/operations_reviews_market_window_index/);
  });

  it('finds a month of snapshots by its whole identity', async () => {
    const plan = await planFor(
      db,
      `SELECT id FROM community_metric_snapshots
       WHERE market_code = 'DZ' AND scope_type = 'market' AND scope_code = 'DZ'
         AND period_month BETWEEN '2026-01' AND '2026-12'`,
    );

    expect(plan).toMatch(/community_metric_snapshots_identity_unique/);
  });

  it("groups a market's closeouts by outcome without a full scan", async () => {
    const plan = await planFor(
      db,
      `SELECT outcome, count(*) FROM event_closeouts
       WHERE market_code = 'DZ' AND submitted_at >= 0 GROUP BY outcome`,
    );

    expect(plan).toMatch(/event_closeouts_market_outcome_index/);
  });
});
