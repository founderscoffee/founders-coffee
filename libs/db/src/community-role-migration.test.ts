import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createDb } from './db.js';
import { initializeMemberProfile } from './member-profiles.js';
import { atMigration, columnNames, priorHost } from './migrations.fixtures.js';

describe('PF-04 self-description removal on populated D1', () => {
  it('drops the profile role and its flag without changing account permissions or remaining profile data', async () => {
    const fixture = await atMigration('0024_remove_profile_community_role.sql');
    await initializeMemberProfile(createDb(env.PRIOR_DB), priorHost.id);
    await env.PRIOR_DB.prepare(
      'UPDATE member_profiles SET community_role = ?, publish_community_role = 1, interests = ?, spoken_languages = ?, publish_interests = 1 WHERE user_id = ?',
    )
      .bind(
        'founder',
        '["investing","idea_validation"]',
        '["ar","fr","en","es","de","ber"]',
        priorHost.id,
      )
      .run();
    const before = await env.PRIOR_DB.prepare(
      'SELECT * FROM member_profiles WHERE user_id = ?',
    )
      .bind(priorHost.id)
      .first();
    const account = await env.PRIOR_DB.prepare(
      'SELECT * FROM user WHERE id = ?',
    )
      .bind(priorHost.id)
      .first();
    expect(before).toMatchObject({
      community_role: 'founder',
      publish_community_role: 1,
    });
    await fixture.apply();
    const columns = await columnNames('member_profiles');
    expect(columns).not.toContain('community_role');
    expect(columns).not.toContain('publish_community_role');
    const expected = { ...before };
    delete expected.community_role;
    delete expected.publish_community_role;
    expect(
      await env.PRIOR_DB.prepare(
        'SELECT * FROM member_profiles WHERE user_id = ?',
      )
        .bind(priorHost.id)
        .first(),
    ).toEqual(expected);
    expect(
      await env.PRIOR_DB.prepare('SELECT * FROM user WHERE id = ?')
        .bind(priorHost.id)
        .first(),
    ).toEqual(account);
    expect(
      (await env.PRIOR_DB.prepare('PRAGMA foreign_key_check').all()).results,
    ).toEqual([]);
    await fixture.apply();
    expect(await columnNames('member_profiles')).toEqual(columns);
  });
});
