import { env } from 'cloudflare:workers';
import { eq } from 'drizzle-orm';
import { describe, expect, it } from 'vitest';

import { createDb } from './db.js';
import { atMigration, columnNames, priorHost } from './migrations.fixtures.js';
import { initializeMemberProfile } from './member-profiles.js';
import {
  account,
  accountPreferences,
  eventRsvps,
  memberProfiles,
  orders,
  invoices,
  profileAssets,
  pushSessionLinks,
  pushSubscriptions,
  scheduledNotifications,
  session,
  user,
} from './schema.js';

describe('PF-03 residence contraction on populated D1', () => {
  it('drops only residence while preserving dependent rows, credentials, indices and foreign keys', async () => {
    const fixture = await atMigration('0021_remove_profile_residence.sql');
    const db = createDb(env.PRIOR_DB);
    const userId = priorHost.id;
    await env.PRIOR_DB.prepare(
      "UPDATE user SET home_market_code = 'DZ', home_state = '16', home_city_id = '556' WHERE id = ?",
    )
      .bind(userId)
      .run();
    await initializeMemberProfile(db, userId);
    await db.insert(session).values({
      id: 'ses_contract',
      userId,
      token: 'contract-session',
      expiresAt: new Date('2099-01-01'),
    });
    await db.insert(account).values({
      id: 'acc_contract',
      userId,
      accountId: 'oauth-sub',
      providerId: 'google',
      accessToken: 'fixture-access',
      refreshToken: 'fixture-refresh',
    });
    await db
      .insert(eventRsvps)
      .values({ id: 'rsvp_contract', eventId: fixture.event.id, userId });
    await db.insert(scheduledNotifications).values({
      id: 'ntf_contract',
      userId,
      eventId: fixture.event.id,
      channel: 'email',
      templateKey: 'reminder_24h',
      sendAt: new Date('2099-01-01'),
      payload: { locale: 'fr' },
    });
    await db.insert(pushSubscriptions).values({
      id: 'push_contract',
      userId,
      token: 'fixture-push',
      platform: 'web',
      surface: 'pwa',
      marketCode: 'DZ',
    });
    await db.insert(pushSessionLinks).values({
      subscriptionId: 'push_contract',
      userId,
      sessionId: 'ses_contract',
    });
    await db.insert(profileAssets).values({
      id: 'asset_contract',
      userId,
      objectKey: 'profiles/contract.webp',
      status: 'ready',
      expiresAt: new Date('2099-01-01'),
    });
    await db
      .update(memberProfiles)
      .set({
        introduction: 'Private introduction',
        introductionLocale: 'en',
        photoAssetId: 'asset_contract',
        publishPhoto: true,
        revision: 7,
      })
      .where(eq(memberProfiles.userId, userId));
    await db
      .update(accountPreferences)
      .set({ smsFallbackEnabled: true, smsConsentAt: new Date(), revision: 3 })
      .where(eq(accountPreferences.userId, userId));
    await db.insert(orders).values({
      id: 'ord_contract',
      marketCode: 'DZ',
      payerUserId: userId,
      purpose: 'sponsorship',
      amountMinor: 100,
      currency: 'DZD',
    });
    await db.insert(invoices).values({
      id: 'inv_contract',
      orderId: 'ord_contract',
      number: 'CONTRACT-1',
      billToName: 'Fixture',
      billToEmail: 'fixture@example.com',
      amountMinor: 100,
      currency: 'DZD',
    });
    const tables = [
      'account',
      'session',
      'events',
      'event_rsvps',
      'scheduled_notifications',
      'push_subscriptions',
      'push_session_links',
      'profile_assets',
      'member_profiles',
      'account_preferences',
      'orders',
      'invoices',
    ];
    const rows = async () =>
      Promise.all(
        tables.map(
          async (table) =>
            (
              await env.PRIOR_DB.prepare(
                `SELECT * FROM ${table} ORDER BY 1`,
              ).all()
            ).results,
        ),
      );
    const before = await rows();
    const identity = await db.select().from(user).where(eq(user.id, userId));
    const indices = (
      await env.PRIOR_DB.prepare(
        "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name",
      ).all()
    ).results;
    await fixture.apply();
    expect(await rows()).toEqual(before);
    expect(await db.select().from(user).where(eq(user.id, userId))).toEqual(
      identity,
    );
    expect(await columnNames('user')).not.toEqual(
      expect.arrayContaining([
        'home_market_code',
        'home_state',
        'home_city_id',
      ]),
    );
    for (const field of ['home_market_code', 'home_state', 'home_city_id'])
      expect(await columnNames('user')).not.toContain(field);
    expect(
      (await env.PRIOR_DB.prepare('PRAGMA foreign_key_check').all()).results,
    ).toEqual([]);
    expect(
      (await env.PRIOR_DB.prepare('PRAGMA foreign_key_list(user)').all())
        .results,
    ).toEqual([]);
    expect(
      (
        await env.PRIOR_DB.prepare(
          "SELECT name, sql FROM sqlite_master WHERE type = 'index' AND sql IS NOT NULL ORDER BY name",
        ).all()
      ).results,
    ).toEqual(indices);
    expect(
      (
        await env.PRIOR_DB.prepare(
          "SELECT name FROM sqlite_master WHERE name LIKE '__pf03_%' OR name = '__new_user'",
        ).all()
      ).results,
    ).toEqual([]);
    await fixture.apply();
    expect(await rows()).toEqual(before);
    await expect(
      db.insert(user).values({
        id: 'usr_duplicate',
        name: 'Duplicate',
        email: priorHost.email,
      }),
    ).rejects.toThrow();
    await expect(
      db.insert(eventRsvps).values({
        id: 'rsvp_invalid',
        eventId: fixture.event.id,
        userId: 'usr_missing',
      }),
    ).rejects.toThrow();
  });
});
