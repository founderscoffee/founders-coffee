import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';

import { ACCOUNT_ROWS, accountId, derivedId, eventRows } from './rows.mjs';
import { insertIgnore, literal } from './sql.mjs';
import { seedStatements } from './statements.mjs';

const MIGRATIONS = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  'libs/db/migrations',
);

const ID_FORMAT = /^[a-z]{2,8}_[0-9a-f]{32}$/;
const ACCOUNT_FORMAT = /^[A-Za-z0-9]{32}$/;

/**
 * A database built by the migrations themselves, not by a copy of the schema.
 *
 * Every statement the product has ever run against D1 runs here in order, so a column added,
 * dropped or made `NOT NULL` reaches this test the same day it reaches the database. A fixture
 * holding its own `CREATE TABLE` would instead keep agreeing with a schema that no longer exists.
 * Foreign keys stay off while the migrations run — several rebuild a table by copying it — and go
 * on before the seed, which is the part whose references are under test.
 *
 * @returns {DatabaseSync} an in-memory database at the current schema.
 */
const migrated = () => {
  const db = new DatabaseSync(':memory:');
  const files = readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith('.sql'))
    .sort();
  expect(files.length, 'no migrations were found to apply').toBeGreaterThan(0);

  for (const file of files)
    for (const statement of readFileSync(
      path.join(MIGRATIONS, file),
      'utf8',
    ).split('--> statement-breakpoint')) {
      const trimmed = statement.trim();
      if (trimmed !== '') db.exec(trimmed);
    }

  db.exec('PRAGMA foreign_keys = ON');
  return db;
};

const seeded = (now = 1_800_000_000) => {
  const db = migrated();
  for (const statement of seedStatements(now)) db.exec(statement);
  return db;
};

const rows = (db, sql) => db.prepare(sql).all();
const count = (db, table) =>
  db.prepare(`select count(*) as n from "${table}"`).get().n;

describe('the dev seed against a database the migrations built', () => {
  it('lands every row it declares', () => {
    const db = seeded();

    expect(count(db, 'markets')).toBe(3);
    expect(count(db, 'user')).toBe(ACCOUNT_ROWS.length);
    expect(count(db, 'member_profiles')).toBe(ACCOUNT_ROWS.length);
    expect(count(db, 'account_preferences')).toBe(ACCOUNT_ROWS.length);
    expect(count(db, 'events')).toBe(3);
    expect(count(db, 'event_rsvps')).toBe(2);
  });

  it('breaks no foreign key', () => {
    const db = seeded();

    expect(rows(db, 'pragma foreign_key_check')).toEqual([]);
  });

  it('changes nothing when it runs a second time', () => {
    const db = seeded();
    const before = rows(db, 'select * from events order by id');

    for (const statement of seedStatements(1_900_000_000)) db.exec(statement);

    expect(
      count(db, 'events'),
      'a second run inserted again, so the seed is not safe to re-run and a developer who runs it twice gets duplicate events under different ids',
    ).toBe(3);
    expect(count(db, 'event_rsvps')).toBe(2);
    expect(
      rows(db, 'select * from events order by id'),
      'a second run rewrote rows that were already there, which would discard whatever the developer had changed by hand',
    ).toEqual(before);
  });

  it('leaves an event the closeout command can actually be run against', () => {
    const now = 1_800_000_000;
    const db = seeded(now);

    const ready = rows(
      db,
      `select id, ends_at, status,
              (select count(*) from event_rsvps r where r.event_id = e.id) as going
         from events e
        where e.status = 'published' and e.ends_at is not null and e.ends_at < ${now}`,
    );

    expect(
      ready.length,
      'no seeded event has ended, so the closeout and feedback commands have nothing to run against — which is the gap this seed exists to close',
    ).toBeGreaterThan(0);
    expect(
      ready[0].going,
      'the ended event has no attendees, so attendance marking has nobody to mark',
    ).toBeGreaterThan(0);
    expect(
      ID_FORMAT.test(ready[0].id),
      `${ready[0].id} is not a shape submitCloseoutSchema accepts, so the page would load and the submission would fail`,
    ).toBe(true);
  });

  it('leaves an event that still accepts an RSVP', () => {
    const now = 1_800_000_000;
    const db = seeded(now);

    const upcoming = rows(
      db,
      `select id from events where status = 'published' and starts_at > ${now}`,
    );

    expect(
      upcoming.length,
      'every seeded event has started, and §5.17 freezes RSVP intent at startsAt, so the RSVP path cannot be exercised',
    ).toBeGreaterThan(0);
  });

  it('spans more than one market', () => {
    const db = seeded();

    expect(
      new Set(
        rows(db, 'select market_code from events').map((r) => r.market_code),
      ).size,
      'every seeded event sits in one market, so a query that crosses markets has nothing to get wrong',
    ).toBeGreaterThan(1);
  });

  it('keeps the denormalised counter equal to the rows it counts', () => {
    const db = seeded();

    const disagreeing = rows(
      db,
      `select e.id, e.rsvps,
              (select count(*) from event_rsvps r where r.event_id = e.id) as actual
         from events e
        where e.rsvps <> (select count(*) from event_rsvps r where r.event_id = e.id)`,
    );

    expect(
      disagreeing,
      'events.rsvps is the number the listing renders and the capacity check reads; seeding rows without it makes a full event look empty',
    ).toEqual([]);
  });
});

describe('the ids the seed mints', () => {
  it('gives every entity the shared id format', () => {
    const { events, rsvps } = eventRows(1_800_000_000);

    for (const row of [...events, ...rsvps])
      expect(
        ID_FORMAT.test(row.id),
        `${row.id} is not a shared-format id`,
      ).toBe(true);
  });

  it('gives every account the shape Better Auth mints', () => {
    for (const account of ACCOUNT_ROWS)
      expect(
        ACCOUNT_FORMAT.test(account.id),
        `${account.id} is not 32 characters of a-zA-Z0-9, so it is not a shape any real account has`,
      ).toBe(true);
  });

  it('derives the same id every run, which is what lets the seed be re-run', () => {
    expect(derivedId('evt', 'dev-rsvp-open')).toBe(
      derivedId('evt', 'dev-rsvp-open'),
    );
    expect(derivedId('evt', 'a')).not.toBe(derivedId('evt', 'b'));
    expect(accountId('one@dev.invalid')).not.toBe(accountId('two@dev.invalid'));
  });

  it('does not move when the clock does', () => {
    expect(eventRows(1).events.map((e) => e.id)).toEqual(
      eventRows(2_000_000_000).events.map((e) => e.id),
    );
  });
});

describe('rendering values into a statement', () => {
  it('closes a quote rather than letting it end the literal', () => {
    expect(literal("Café d'Alger")).toBe("'Café d''Alger'");
    expect(literal("'; DROP TABLE events; --")).toBe(
      "'''; DROP TABLE events; --'",
    );
  });

  it('survives a rendered injection attempt against a real database', () => {
    const db = migrated();
    db.exec(
      insertIgnore('markets', [
        {
          code: 'ZZ',
          name: "'); DROP TABLE events; --",
          slug: 'zz',
          default_locale: 'ar',
          default_currency: 'DZD',
          timezone: 'UTC',
          direction: 'rtl',
          state: 'active',
          feature_flags: '{}',
        },
      ]),
    );

    expect(rows(db, "select name from markets where code = 'ZZ'")[0].name).toBe(
      "'); DROP TABLE events; --",
    );
    expect(count(db, 'events')).toBe(0);
  });

  it('renders the types a row actually carries', () => {
    expect(literal(null)).toBe('NULL');
    expect(literal(undefined)).toBe('NULL');
    expect(literal(42)).toBe('42');
    expect(literal(true)).toBe('1');
    expect(() => literal(Number.NaN)).toThrow(/refusing/);
    expect(() => literal({})).toThrow(/refusing/);
  });

  it('refuses rows that disagree about their columns', () => {
    expect(() => insertIgnore('user', [{ id: 'a' }, { name: 'b' }])).toThrow(
      /same columns/,
    );
    expect(insertIgnore('user', [])).toBe('');
  });
});
