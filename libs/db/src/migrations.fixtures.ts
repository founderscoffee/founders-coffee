import { applyD1Migrations } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { getTableColumns, type Column } from 'drizzle-orm';
import { expect } from 'vitest';

import { SEED_MARKETS } from './seed.js';
import { markets, type NewUser } from './schema.js';

export const priorHost: NewUser = {
  id: 'usr_prior_schema_host',
  name: 'Prior Schema Host',
  email: 'prior-schema@test.coffee',
  emailVerified: false,
  role: 'host',
};

let tag = 0;

export const priorEvent = (suffix: string) => ({
  id: `evt_prior_${suffix}`,
  hostId: priorHost.id,
  marketCode: 'DZ' as const,
  stateCode: '01',
  cityCode: '1',
  title: 'Prior schema event',
  description: 'An event that must survive the migration.',
  venue: 'Migration Café',
  startsAt: new Date('2099-08-01T18:00:00Z'),
  language: 'fr' as const,
  slug: `prior-schema-event-${suffix}`,
});

type PriorEvent = ReturnType<typeof priorEvent>;

export const columnNames = async (table: string): Promise<string[]> => {
  const columns = await env.PRIOR_DB.prepare(
    `PRAGMA table_info('${table}')`,
  ).all<{ name: string }>();
  return columns.results.map((column) => column.name);
};

/**
 * Insert a prior-schema event with raw SQL, filling in whatever legacy columns that schema still
 * declares.
 *
 * `createEvent` builds its column list from the *current* Drizzle schema, so it stops working the
 * moment a column is dropped: every table older than the dropping migration still declares that
 * column `NOT NULL` and rejects an insert that omits it. Reading the columns back from the database
 * is what keeps this harness usable on both sides of a drop.
 */
const insertPriorEvent = async (event: PriorEvent): Promise<void> => {
  const columns = [
    'id',
    'host_id',
    'market_code',
    'state_code',
    'city_code',
    'title',
    'description',
    'venue',
    'starts_at',
    'language',
    'slug',
  ];
  const values: unknown[] = [
    event.id,
    event.hostId,
    event.marketCode,
    event.stateCode,
    event.cityCode,
    event.title,
    event.description,
    event.venue,
    Math.floor(event.startsAt.getTime() / 1000),
    event.language,
    event.slug,
  ];
  const legacy = await columnNames('events');
  if (legacy.includes('capacity')) {
    columns.push('capacity');
    values.push(20);
  }
  if (legacy.includes('category')) {
    columns.push('category');
    values.push('coffee-meetup');
  }

  await env.PRIOR_DB.prepare(
    `INSERT INTO events (${columns.join(', ')})
     VALUES (${columns.map(() => '?').join(', ')})`,
  )
    .bind(...values)
    .run();
};

/**
 * Seed the launch markets with raw SQL, naming only the columns the prior schema declares.
 *
 * `seed` builds its insert from the *current* Drizzle schema, which breaks on both sides of a
 * change: a dropped column leaves it naming something gone, and a column added after the migration
 * under test leaves it naming something not there yet. `markets.name_fr` was the first of the
 * second kind and broke all twenty migration tests at once. The column list and the values still
 * come from the schema and from `SEED_MARKETS`, through `mapToDriverValue` so JSON and boolean
 * columns are encoded the way Drizzle would encode them — the database only decides which of them
 * to keep.
 */
const insertPriorMarkets = async (): Promise<void> => {
  const declared: Record<string, Column> = getTableColumns(markets);
  const present = new Set(await columnNames('markets'));
  for (const market of SEED_MARKETS) {
    const row = Object.entries(market)
      .map(([field, value]) => ({ column: declared[field], value }))
      .filter(({ column }) => column !== undefined && present.has(column.name))
      .map(({ column, value }) => ({
        name: column?.name ?? '',
        driverValue: column?.mapToDriverValue(value) ?? null,
      }));
    await env.PRIOR_DB.prepare(
      `INSERT INTO markets (${row.map((c) => c.name).join(', ')})
       VALUES (${row.map(() => '?').join(', ')})
       ON CONFLICT (code) DO NOTHING`,
    )
      .bind(...row.map((c) => c.driverValue))
      .run();
  }
};

/**
 * Apply every migration before `name` and seed the prior schema with real rows, returning the
 * fixture ids and a callback that applies the migration under test.
 *
 * Migrations are located by name, never by position, so a later migration cannot silently retarget
 * an existing test — which is exactly what a `TEST_MIGRATIONS.at(-1)` assertion did before.
 */
export const atMigration = async (name: string) => {
  const index = env.TEST_MIGRATIONS.findIndex((m) => m.name === name);
  expect(index, `migration ${name} not found`).toBeGreaterThanOrEqual(0);
  const suffix = `m${++tag}`;

  await applyD1Migrations(env.PRIOR_DB, env.TEST_MIGRATIONS.slice(0, index));
  await insertPriorMarkets();
  await env.PRIOR_DB.prepare(
    'INSERT INTO user (id, name, email, email_verified, role) VALUES (?, ?, ?, 0, ?) ON CONFLICT (id) DO NOTHING',
  )
    .bind(priorHost.id, priorHost.name, priorHost.email, priorHost.role)
    .run();
  const event = priorEvent(suffix);
  await insertPriorEvent(event);

  return {
    suffix,
    event,
    apply: () => applyD1Migrations(env.PRIOR_DB, [env.TEST_MIGRATIONS[index]]),
  };
};

export const indexNames = async (table: string): Promise<string[]> => {
  const indexes = await env.PRIOR_DB.prepare(
    `PRAGMA index_list('${table}')`,
  ).all<{ name: string }>();
  return indexes.results.map((i) => i.name);
};
