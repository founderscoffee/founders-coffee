import { env } from 'cloudflare:workers';
import { assert, describe, expect, it } from 'vitest';

import { createDb } from './db.js';
import { initializeMemberProfile } from './member-profiles.js';
import { atMigration, columnNames, priorHost } from './migrations.fixtures.js';
import {
  attachReadyProfilePhoto,
  getDeliverableProfilePhoto,
  reserveProfileAsset,
} from './profile-assets.js';

describe('PF-06 avatar visibility contraction on populated D1', () => {
  it('drops only the visibility flag and preserves the avatar and other privacy choices', async () => {
    const fixture = await atMigration('0022_remove_photo_visibility.sql');
    const db = createDb(env.PRIOR_DB);
    await initializeMemberProfile(db, priorHost.id);
    const asset = await reserveProfileAsset(
      db,
      priorHost.id,
      new Date('2099-01-01'),
    );
    assert(asset);
    await attachReadyProfilePhoto(db, {
      userId: priorHost.id,
      assetId: asset.id,
      mimeType: 'image/webp',
      byteSize: 1024,
      width: 320,
      height: 320,
    });
    await env.PRIOR_DB.prepare(
      'UPDATE member_profiles SET publish_photo = 0, introduction = ?, introduction_locale = ?, publish_introduction = 0 WHERE user_id = ?',
    )
      .bind('Private introduction', 'en', priorHost.id)
      .run();
    const before = await env.PRIOR_DB.prepare(
      'SELECT * FROM member_profiles WHERE user_id = ?',
    )
      .bind(priorHost.id)
      .first();
    expect(before).toHaveProperty('publish_photo', 0);
    await fixture.apply();
    expect(await columnNames('member_profiles')).not.toContain('publish_photo');
    const after = await env.PRIOR_DB.prepare(
      'SELECT * FROM member_profiles WHERE user_id = ?',
    )
      .bind(priorHost.id)
      .first();
    const expected = { ...before };
    delete expected.publish_photo;
    expect(after).toEqual(expected);
    expect(await getDeliverableProfilePhoto(db, asset.id)).not.toBeNull();
    expect(
      (await env.PRIOR_DB.prepare('PRAGMA foreign_key_check').all()).results,
    ).toEqual([]);
    await fixture.apply();
    expect(await columnNames('member_profiles')).not.toContain('publish_photo');
  });
});
