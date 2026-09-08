import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { createDb } from './db.js';
import { atMigration, priorHost } from './migrations.fixtures.js';
import { getMemberProfile } from './member-profiles.js';
import { getAccountPreferences } from './account-preferences.js';
import { eventRsvps, events, session, user } from './schema.js';

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
    expect(await getMemberProfile(db, priorHost.id)).toMatchObject({
      locale: 'fr',
      profile: {
        revision: 0,
        photoAssetId: null,
        publishPhoto: false,
        publishIntroduction: false,
        publishCommunityRole: false,
        publishInterests: false,
        publishSpokenLanguages: false,
        publishProfessionalLink: false,
        interests: [],
        spokenLanguages: [],
      },
    });
    expect(await getAccountPreferences(db, priorHost.id)).toMatchObject({
      preferences: {
        pushEnabled: false,
        smsFallbackEnabled: false,
        smsConsentAt: null,
        followUpPrompts: false,
      },
    });
    expect(
      (await db.select().from(user).where(eq(user.id, priorHost.id)))[0],
    ).toMatchObject({
      homeMarketCode: 'DZ',
      homeState: '16',
      homeCityId: '1',
      accountState: 'active',
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
    expect(await getMemberProfile(db, priorHost.id)).toMatchObject({
      profile: { revision: 0 },
    });
  });
});
