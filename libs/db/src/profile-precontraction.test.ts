import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeAll, describe, expect, it } from 'vitest';

import { createDb, type Db } from './db.js';
import {
  getMemberProfile,
  getProfileIdentity,
  initializeMemberProfile,
  updateMemberProfile,
} from './member-profiles.js';
import { user } from './schema.js';

/**
 * The state production actually runs between the PF-03a release and the PF-03b promotion: code that
 * has forgotten residence, against a schema that still has the columns and the home-market foreign
 * key. `setup.ts` applies the pending contraction to the main test database, so every other suite
 * proves the *contracted* schema — this one proves the window in between, which is the only state
 * live members will be served during it.
 */
const priorSchemaDb = async (): Promise<Db> => {
  const shipped = (
    env as unknown as {
      SHIPPED_MIGRATIONS: Parameters<typeof applyD1Migrations>[1];
    }
  ).SHIPPED_MIGRATIONS;
  await applyD1Migrations(env.PRIOR_DB, shipped);
  return createDb(env.PRIOR_DB);
};

const MEMBER = {
  id: 'usr_precontraction_member',
  name: 'Precontraction Member',
  email: 'precontraction@test.coffee',
  emailVerified: true,
  role: 'member',
} as const;

describe('profile repositories against the pre-contraction schema', () => {
  let db: Db;

  beforeAll(async () => {
    db = await priorSchemaDb();
  });

  it('still has the residence columns this window has not dropped yet', async () => {
    const columns = await env.PRIOR_DB.prepare(
      'SELECT name FROM pragma_table_info(?)',
    )
      .bind('user')
      .all<{ name: string }>();
    const names = columns.results.map((row) => row.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'home_market_code',
        'home_state',
        'home_city_id',
      ]),
    );
  });

  it('registers a member without naming the columns it no longer knows about', async () => {
    await db.insert(user).values(MEMBER).run();

    const identity = await getProfileIdentity(db, MEMBER.id);
    expect(identity).toMatchObject({ name: MEMBER.name, email: MEMBER.email });
  });

  it('initializes, reads and conditionally updates the profile', async () => {
    await initializeMemberProfile(db, MEMBER.id);
    const initial = await getMemberProfile(db, MEMBER.id);
    expect(initial?.profile.revision).toBe(0);

    const saved = await updateMemberProfile(db, {
      userId: MEMBER.id,
      displayName: 'Renamed Member',
      expectedRevision: 0,
      changes: {
        introduction: 'A short hello.',
        interests: ['product'],
        spokenLanguages: ['en'],
        professionalLink: null,
        publishInterests: false,
        publishSpokenLanguages: false,
        publishProfessionalLink: false,
      },
    });

    expect(saved?.revision).toBe(1);
    expect(saved?.introduction).toBe('A short hello.');
    expect((await getMemberProfile(db, MEMBER.id))?.profile.revision).toBe(1);
  });

  it('rejects a stale revision here exactly as it does after contraction', async () => {
    const stale = await updateMemberProfile(db, {
      userId: MEMBER.id,
      displayName: 'Stale Writer',
      expectedRevision: 0,
      changes: {
        introduction: null,
        interests: [],
        spokenLanguages: [],
        professionalLink: null,
        publishInterests: false,
        publishSpokenLanguages: false,
        publishProfessionalLink: false,
      },
    });

    expect(stale).toBeNull();
    expect((await getMemberProfile(db, MEMBER.id))?.displayName).toBe(
      'Renamed Member',
    );
  });
});
