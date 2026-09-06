import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createDb } from './db.js';
import { getEvent } from './events.js';
import {
  atMigration,
  columnNames,
  indexNames,
  priorHost,
} from './migrations.fixtures.js';

describe('0012 — events route key (real D1)', () => {
  it('upgrades the prior schema without losing data', async () => {
    const { event, apply } = await atMigration('0012_amusing_mesmero.sql');

    await apply();

    const persisted = await env.PRIOR_DB.prepare(
      'SELECT id, market_code, slug FROM events WHERE id = ?',
    )
      .bind(event.id)
      .first<{ id: string; market_code: string; slug: string }>();

    expect(persisted).toEqual({
      id: event.id,
      market_code: 'DZ',
      slug: event.slug,
    });
    expect(await indexNames('events')).toContain(
      'events_market_code_slug_unique',
    );
  });
});

describe('0013 — notification fallback link (real D1)', () => {
  it('adds fallback_of without losing existing notifications', async () => {
    const { suffix, event, apply } = await atMigration(
      '0013_tidy_alex_power.sql',
    );
    const rowId = `ntf_prior_${suffix}`;

    await env.PRIOR_DB.prepare(
      `INSERT INTO scheduled_notifications
         (id, event_id, user_id, channel, status, template_key, payload, send_at,
          attempts, fallback_channel, created_at, updated_at)
       VALUES (?, ?, ?, 'sms', 'pending', 'rsvp_confirmation', '{"smsBody":"hi"}',
               4102444800, 0, 'email', unixepoch(), unixepoch())`,
    )
      .bind(rowId, event.id, priorHost.id)
      .run();

    await apply();

    const persisted = await env.PRIOR_DB.prepare(
      `SELECT id, channel, status, fallback_channel, fallback_of
         FROM scheduled_notifications WHERE id = ?`,
    )
      .bind(rowId)
      .first<Record<string, unknown>>();

    expect(persisted).toEqual({
      id: rowId,
      channel: 'sms',
      status: 'pending',
      fallback_channel: 'email',
      fallback_of: null,
    });
    expect(await indexNames('scheduled_notifications')).toContain(
      'scheduled_notifications_fallback_of_unique',
    );
  });

  it('permits many rows with a null fallback_of, and only one fallback per parent', async () => {
    const { suffix, event, apply } = await atMigration(
      '0013_tidy_alex_power.sql',
    );
    await apply();

    const insert = async (rowId: string, fallbackOf: string | null) => {
      await env.PRIOR_DB.prepare(
        `INSERT INTO scheduled_notifications
           (id, event_id, user_id, channel, status, template_key, payload, send_at,
            attempts, fallback_of, created_at, updated_at)
         VALUES (?, ?, ?, 'sms', 'pending', 'rsvp_confirmation', '{}',
                 4102444800, 0, ?, unixepoch(), unixepoch())`,
      )
        .bind(rowId, event.id, priorHost.id, fallbackOf)
        .run();
    };

    await insert(`ntf_a_${suffix}`, null);
    await insert(`ntf_b_${suffix}`, null);
    await insert(`ntf_c_${suffix}`, `ntf_a_${suffix}`);

    await expect(insert(`ntf_d_${suffix}`, `ntf_a_${suffix}`)).rejects.toThrow(
      /UNIQUE constraint failed/,
    );
  });
});

describe('0014 — notification claim (real D1)', () => {
  it('adds claimed_at without losing existing notifications', async () => {
    const { suffix, event, apply } = await atMigration(
      '0014_fearless_secret_warriors.sql',
    );
    const rowId = `ntf_claim_${suffix}`;

    await env.PRIOR_DB.prepare(
      `INSERT INTO scheduled_notifications
         (id, event_id, user_id, channel, status, template_key, payload, send_at,
          attempts, fallback_channel, created_at, updated_at)
       VALUES (?, ?, ?, 'sms', 'pending', 'rsvp_confirmation', '{"smsBody":"hi"}',
               4102444800, 0, 'email', unixepoch(), unixepoch())`,
    )
      .bind(rowId, event.id, priorHost.id)
      .run();

    await apply();

    const persisted = await env.PRIOR_DB.prepare(
      'SELECT id, status, claimed_at FROM scheduled_notifications WHERE id = ?',
    )
      .bind(rowId)
      .first<{ id: string; status: string; claimed_at: number | null }>();

    expect(persisted).toEqual({
      id: rowId,
      status: 'pending',
      claimed_at: null,
    });
    expect(await indexNames('scheduled_notifications')).toContain(
      'idx_scheduled_notifications_processing',
    );
  });
});

describe('0015 — dispatch marker (real D1)', () => {
  it('adds dispatch_started_at without losing existing notifications', async () => {
    const { suffix, event, apply } = await atMigration('0015_left_alice.sql');
    const rowId = `ntf_dispatch_${suffix}`;

    await env.PRIOR_DB.prepare(
      `INSERT INTO scheduled_notifications
         (id, event_id, user_id, channel, status, template_key, payload, send_at,
          attempts, created_at, updated_at)
       VALUES (?, ?, ?, 'sms', 'processing', 'rsvp_confirmation', '{}',
               4102444800, 1, unixepoch(), unixepoch())`,
    )
      .bind(rowId, event.id, priorHost.id)
      .run();

    await apply();

    const persisted = await env.PRIOR_DB.prepare(
      'SELECT id, status, attempts, dispatch_started_at FROM scheduled_notifications WHERE id = ?',
    )
      .bind(rowId)
      .first<Record<string, unknown>>();

    expect(persisted).toEqual({
      id: rowId,
      status: 'processing',
      attempts: 1,
      dispatch_started_at: null,
    });
  });
});

describe('0016 — host event index (real D1)', () => {
  it('indexes events by host without losing existing rows', async () => {
    const { event, apply } = await atMigration('0016_light_alex_wilder.sql');
    expect(await indexNames('events')).not.toContain('events_host_id_index');

    await apply();

    expect(await indexNames('events')).toContain('events_host_id_index');
    const kept = await getEvent(createDb(env.PRIOR_DB), event.id);
    expect(kept?.hostId).toBe(event.hostId);
  });
});

describe('0017 — capacity and category retire (real D1)', () => {
  it('drops both columns and keeps everything else about the event', async () => {
    const { event, apply } = await atMigration('0017_calm_red_wolf.sql');
    expect(await columnNames('events')).toEqual(
      expect.arrayContaining(['capacity', 'category']),
    );

    await apply();

    const columns = await columnNames('events');
    expect(columns).not.toContain('capacity');
    expect(columns).not.toContain('category');

    const kept = await getEvent(createDb(env.PRIOR_DB), event.id);
    expect(kept).toMatchObject({
      id: event.id,
      title: event.title,
      venue: event.venue,
      slug: event.slug,
      language: event.language,
      rsvps: 0,
    });
    expect(await indexNames('events')).toContain(
      'events_market_code_slug_unique',
    );
  });
});
