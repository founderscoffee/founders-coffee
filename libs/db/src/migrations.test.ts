import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createDb } from './db.js';
import { createEvent } from './events.js';
import { seed } from './seed.js';
import { user, type NewUser } from './schema.js';

const priorHost: NewUser = {
  id: 'usr_prior_schema_host',
  name: 'Prior Schema Host',
  email: 'prior-schema@test.coffee',
  emailVerified: false,
  role: 'host',
};

const priorEvent = {
  id: 'evt_prior_schema_event',
  hostId: priorHost.id,
  marketCode: 'DZ' as const,
  stateCode: '01',
  cityCode: '1',
  title: 'Prior schema event',
  description: 'An event that must survive the route-key migration.',
  venue: 'Migration Café',
  startsAt: new Date('2099-08-01T18:00:00Z'),
  capacity: 20,
  language: 'ar_fr' as const,
  category: 'coffee-meetup' as const,
  slug: 'prior-schema-event',
};

describe('events route-key migration (real D1)', () => {
  it('upgrades the prior schema without losing data', async () => {
    const currentMigration = env.TEST_MIGRATIONS.at(-1);
    expect(currentMigration?.name).toBe('0012_amusing_mesmero.sql');
    if (!currentMigration) return;

    await applyD1Migrations(env.PRIOR_DB, env.TEST_MIGRATIONS.slice(0, -1));
    const db = createDb(env.PRIOR_DB);
    await seed(db);
    await db.insert(user).values(priorHost).run();
    await createEvent(db, priorEvent);

    await applyD1Migrations(env.PRIOR_DB, [currentMigration]);

    const persisted = await env.PRIOR_DB.prepare(
      'SELECT id, market_code, slug FROM events WHERE id = ?',
    )
      .bind(priorEvent.id)
      .first<{ id: string; market_code: string; slug: string }>();
    const indexes = await env.PRIOR_DB.prepare(
      "PRAGMA index_list('events')",
    ).all<{ name: string; unique: number }>();

    expect(persisted).toEqual({
      id: priorEvent.id,
      market_code: 'DZ',
      slug: priorEvent.slug,
    });
    expect(indexes.results).toContainEqual(
      expect.objectContaining({
        name: 'events_market_code_slug_unique',
        unique: 1,
      }),
    );
  });
});
