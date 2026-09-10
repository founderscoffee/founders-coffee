import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { atMigration, indexNames, priorHost } from './migrations.fixtures.js';

describe('0025 — the operations schema (real D1)', () => {
  it('adds the seven tables without disturbing existing events or RSVPs', async () => {
    const { suffix, event, apply } = await atMigration(
      '0025_woozy_apocalypse.sql',
    );
    const rsvpId = `rsv_prior_${suffix}`;
    await env.PRIOR_DB.prepare(
      `INSERT INTO event_rsvps (id, event_id, user_id, status, created_at, updated_at)
       VALUES (?, ?, ?, 'going', unixepoch(), unixepoch())`,
    )
      .bind(rsvpId, event.id, priorHost.id)
      .run();

    await apply();

    const persisted = await env.PRIOR_DB.prepare(
      'SELECT id, title, slug, rsvps FROM events WHERE id = ?',
    )
      .bind(event.id)
      .first<{ id: string; title: string; slug: string; rsvps: number }>();
    expect(persisted).toMatchObject({ id: event.id, slug: event.slug });

    const rsvp = await env.PRIOR_DB.prepare(
      'SELECT id, status FROM event_rsvps WHERE id = ?',
    )
      .bind(rsvpId)
      .first<{ id: string; status: string }>();
    expect(rsvp).toEqual({ id: rsvpId, status: 'going' });
  });

  it('creates every operations table the plan specifies', async () => {
    const { apply } = await atMigration('0025_woozy_apocalypse.sql');

    await apply();

    const tables = await env.PRIOR_DB.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name`,
    ).all<{ name: string }>();
    const names = tables.results.map((row) => row.name);
    for (const table of [
      'event_closeouts',
      'event_attendance',
      'event_feedback',
      'host_trust',
      'operations_audit',
      'operations_reviews',
      'community_metric_snapshots',
    ]) {
      expect(names).toContain(table);
    }
  });

  it('brings the indexes the dashboard reads through', async () => {
    const { apply } = await atMigration('0025_woozy_apocalypse.sql');

    await apply();

    expect(await indexNames('event_attendance')).toEqual(
      expect.arrayContaining([
        'event_attendance_event_user_unique',
        'event_attendance_user_index',
      ]),
    );
    expect(await indexNames('operations_audit')).toEqual(
      expect.arrayContaining([
        'operations_audit_market_time_index',
        'operations_audit_target_index',
      ]),
    );
  });

  it('accepts a closeout for an event that predates the migration', async () => {
    const { event, apply } = await atMigration('0025_woozy_apocalypse.sql');

    await apply();
    await env.PRIOR_DB.prepare(
      `INSERT INTO event_closeouts
         (event_id, market_code, state_code, city_code, outcome, walk_in_count,
          host_friction, submitted_by_user_id, submitted_at, updated_at, version)
       VALUES (?, 'DZ', '16', '1', 'held', 0, '[]', ?, unixepoch(), unixepoch(), 0)`,
    )
      .bind(event.id, priorHost.id)
      .run();

    const stored = await env.PRIOR_DB.prepare(
      'SELECT outcome FROM event_closeouts WHERE event_id = ?',
    )
      .bind(event.id)
      .first<{ outcome: string }>();
    expect(stored?.outcome).toBe('held');
  });
});
