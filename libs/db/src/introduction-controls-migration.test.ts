import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createDb } from './db.js';
import { initializeMemberProfile } from './member-profiles.js';
import { atMigration, columnNames, priorHost } from './migrations.fixtures.js';

describe('PF-04 introduction controls contraction on populated D1', () => {
  it('preserves authored text and unrelated privacy settings while dropping the two controls', async () => {
    const fixture = await atMigration('0023_simplify_profile_introduction.sql');
    const db = createDb(env.PRIOR_DB);
    await initializeMemberProfile(db, priorHost.id);
    const introduction = 'أبني مجتمعًا. Building together. Bonjour !';
    await env.PRIOR_DB.prepare(
      'UPDATE member_profiles SET introduction = ?, introduction_locale = ?, publish_introduction = 0, community_role = ?, publish_community_role = 0, interests = ?, publish_interests = 1 WHERE user_id = ?',
    )
      .bind(introduction, 'ar', 'founder', '["community"]', priorHost.id)
      .run();
    const before = await env.PRIOR_DB.prepare(
      'SELECT * FROM member_profiles WHERE user_id = ?',
    )
      .bind(priorHost.id)
      .first();
    expect(before).toMatchObject({
      introduction_locale: 'ar',
      publish_introduction: 0,
    });
    await fixture.apply();
    const columns = await columnNames('member_profiles');
    expect(columns).not.toContain('introduction_locale');
    expect(columns).not.toContain('publish_introduction');
    const expected = { ...before };
    delete expected.introduction_locale;
    delete expected.publish_introduction;
    const after = await env.PRIOR_DB.prepare(
      'SELECT * FROM member_profiles WHERE user_id = ?',
    )
      .bind(priorHost.id)
      .first();
    expect(after).toEqual(expected);
    expect(after).toMatchObject({ introduction, publish_interests: 1 });
    expect(
      (await env.PRIOR_DB.prepare('PRAGMA foreign_key_check').all()).results,
    ).toEqual([]);
    await fixture.apply();
    expect(await columnNames('member_profiles')).toEqual(columns);
  });
});
