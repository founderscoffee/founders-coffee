import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { createDb } from './db.js';
import { atMigration, priorHost } from './migrations.fixtures.js';
import { eventRsvps, events, session } from './schema.js';

const priorProfile = () =>
  env.PRIOR_DB.prepare(
    `SELECT user.locale_pref, member_profiles.*
       FROM member_profiles JOIN user ON user.id = member_profiles.user_id
      WHERE member_profiles.user_id = ?`,
  )
    .bind(priorHost.id)
    .first();

describe('PF-02 additive migration', () => {
  it('backfills private defaults without copying residence or exposing OAuth photos', async () => {
    const fixture = await atMigration('0020_profile_foundation.sql');
    await env.PRIOR_DB.prepare(
      `UPDATE user SET home_market_code = 'DZ', home_state = '16',
      home_city_id = '1', locale_pref = 'fr', image = 'https://provider.test/photo' WHERE id = ?`,
    )
      .bind(priorHost.id)
      .run();
    const sessionId = `ses_prior_${fixture.suffix}`;
    const rsvpId = `rsvp_prior_${fixture.suffix}`;
    await env.PRIOR_DB.batch([
      env.PRIOR_DB.prepare(
        'INSERT INTO session (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)',
      ).bind(sessionId, priorHost.id, 'prior-session-token', 4070908800),
      env.PRIOR_DB.prepare(
        'INSERT INTO event_rsvps (id, event_id, user_id) VALUES (?, ?, ?)',
      ).bind(rsvpId, fixture.event.id, priorHost.id),
    ]);
    await fixture.apply();
    const db = createDb(env.PRIOR_DB);
    expect(await priorProfile()).toMatchObject({
      locale_pref: 'fr',
      revision: 0,
      photo_asset_id: null,
      publish_interests: 0,
      publish_spoken_languages: 0,
      publish_professional_link: 0,
      interests: '[]',
      spoken_languages: '[]',
    });
    expect(
      await env.PRIOR_DB.prepare(
        `SELECT push_enabled, sms_fallback_enabled, sms_consent_at, follow_up_prompts
           FROM account_preferences WHERE user_id = ?`,
      )
        .bind(priorHost.id)
        .first(),
    ).toMatchObject({
      push_enabled: 0,
      sms_fallback_enabled: 0,
      sms_consent_at: null,
      follow_up_prompts: 0,
    });
    expect(
      await env.PRIOR_DB.prepare(
        'SELECT home_market_code, home_state, home_city_id, account_state FROM user WHERE id = ?',
      )
        .bind(priorHost.id)
        .first(),
    ).toMatchObject({
      home_market_code: 'DZ',
      home_state: '16',
      home_city_id: '1',
      account_state: 'active',
    });
    expect(
      (
        await db.select().from(events).where(eq(events.id, fixture.event.id))
      )[0],
    ).toMatchObject({
      hostId: priorHost.id,
      marketCode: 'DZ',
      stateCode: '01',
      cityCode: '1',
    });
    expect(
      (await db.select().from(session).where(eq(session.id, sessionId)))[0],
    ).toMatchObject({
      userId: priorHost.id,
      token: 'prior-session-token',
      expiresAt: new Date(4070908800000),
    });
    expect(
      (await db.select().from(eventRsvps).where(eq(eventRsvps.id, rsvpId)))[0],
    ).toMatchObject({
      userId: priorHost.id,
      eventId: fixture.event.id,
      status: 'going',
    });
    expect(
      (await env.PRIOR_DB.prepare('PRAGMA foreign_key_check').all()).results,
    ).toEqual([]);
    await fixture.apply();
    expect(await priorProfile()).toMatchObject({ revision: 0 });
  });
});
