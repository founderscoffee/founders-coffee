import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  findIncompatibleStatements,
  findIrreversibleStatements,
  parseTableRebuilds,
} from './migration-rebuild.mjs';

const shippedMigrations = path.join(
  import.meta.dirname,
  '..',
  '..',
  'libs',
  'db',
  'migrations',
);

const snapshotOf = (columns) => ({
  tables: {
    account_preferences: {
      name: 'account_preferences',
      columns: Object.fromEntries(
        columns.map((name) => [name, { name, notNull: true, default: false }]),
      ),
    },
  },
});

const rebuildSql = (columns) => {
  const list = columns.map((column) => `"${column}"`).join(', ');
  return [
    'CREATE TABLE `__new_account_preferences` (`user_id` text PRIMARY KEY NOT NULL);',
    `INSERT INTO \`__new_account_preferences\`(${list}) SELECT ${list} FROM \`account_preferences\`;`,
    'DROP TABLE `account_preferences`;',
    'ALTER TABLE `__new_account_preferences` RENAME TO `account_preferences`;',
  ].join('--> statement-breakpoint');
};

const fixtureDirectory = ({ before, after }) => {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), 'migration-rebuild-'),
  );
  fs.mkdirSync(path.join(directory, 'meta'));
  fs.writeFileSync(
    path.join(directory, 'meta', '_journal.json'),
    JSON.stringify({
      entries: [
        { idx: 31, tag: '0031_before' },
        { idx: 32, tag: '0032_rebuild' },
      ],
    }),
  );
  fs.writeFileSync(
    path.join(directory, 'meta', '0031_snapshot.json'),
    JSON.stringify(snapshotOf(before)),
  );
  fs.writeFileSync(
    path.join(directory, 'meta', '0032_snapshot.json'),
    JSON.stringify(snapshotOf(after)),
  );
  return directory;
};

describe('table rebuild recognition', () => {
  it('identifies destructive schema and data operations', () => {
    expect(
      findIrreversibleStatements('ALTER TABLE users DROP COLUMN home_city;'),
    ).not.toEqual([]);
    expect(
      findIrreversibleStatements('CREATE TABLE interests (id TEXT);'),
    ).toEqual([]);
    expect(
      findIrreversibleStatements('DELETE FROM markets WHERE code = "MA";'),
    ).not.toEqual([]);
  });

  it('reads the four steps as one rebuild, and refuses one that drops the copy', () => {
    const sql = rebuildSql(['user_id']);
    expect(parseTableRebuilds(sql)).toEqual(['account_preferences']);
    const withoutCopy = sql
      .split('--> statement-breakpoint')
      .filter((statement) => !statement.startsWith('INSERT'))
      .join('--> statement-breakpoint');
    expect(parseTableRebuilds(withoutCopy)).toEqual([]);
  });

  it('clears a rebuild that keeps every column and flags one that loses a column', () => {
    const columns = ['user_id', 'follow_up_prompts'];
    expect(
      findIncompatibleStatements({
        sql: rebuildSql(columns),
        migration: '0032_rebuild',
        migrationsDirectory: fixtureDirectory({
          before: columns,
          after: columns,
        }),
      }),
    ).toEqual([]);
    expect(
      findIncompatibleStatements({
        sql: rebuildSql(columns),
        migration: '0032_rebuild',
        migrationsDirectory: fixtureDirectory({
          before: [...columns, 'home_city'],
          after: columns,
        }),
      }),
    ).not.toEqual([]);
  });

  it('flags a column that starts refusing writes it used to accept', () => {
    const directory = fixtureDirectory({
      before: ['user_id'],
      after: ['user_id'],
    });
    const snapshot = path.join(directory, 'meta', '0032_snapshot.json');
    const after = JSON.parse(fs.readFileSync(snapshot, 'utf8'));
    after.tables.account_preferences.columns.user_id = {
      name: 'user_id',
      notNull: true,
    };
    const before = JSON.parse(
      fs.readFileSync(
        path.join(directory, 'meta', '0031_snapshot.json'),
        'utf8',
      ),
    );
    before.tables.account_preferences.columns.user_id.notNull = false;
    fs.writeFileSync(snapshot, JSON.stringify(after));
    fs.writeFileSync(
      path.join(directory, 'meta', '0031_snapshot.json'),
      JSON.stringify(before),
    );
    expect(
      findIncompatibleStatements({
        sql: rebuildSql(['user_id']),
        migration: '0032_rebuild',
        migrationsDirectory: directory,
      }),
    ).not.toEqual([]);
  });

  it('refuses a rebuild it cannot check against a snapshot pair', () => {
    expect(
      findIncompatibleStatements({
        sql: rebuildSql(['user_id']),
        migration: '0032_rebuild',
        migrationsDirectory: fs.mkdtempSync(
          path.join(os.tmpdir(), 'migration-unverified-'),
        ),
      }),
    ).not.toEqual([]);
  });

  it('clears the shipped follow-up-prompts default change', () => {
    const migration = '0032_follow_up_prompts_default_on';
    expect(
      findIncompatibleStatements({
        sql: fs.readFileSync(
          path.join(shippedMigrations, `${migration}.sql`),
          'utf8',
        ),
        migration,
        migrationsDirectory: shippedMigrations,
      }),
    ).toEqual([]);
  });
});
