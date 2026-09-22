import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  parsePendingMigrations,
  validateManifestCoverage,
  validatePendingMigrations,
} from './migration-compatibility.mjs';

describe('migration compatibility checks', () => {
  it('parses pending migration names from Wrangler output', () => {
    expect(
      parsePendingMigrations(
        'Applying 0030_add_interest.sql\nApplying 0031_add_index.sql',
      ),
    ).toEqual(['0030_add_interest', '0031_add_index']);
    expect(parsePendingMigrations('✅ No migrations to apply!')).toEqual([]);
  });

  it('requires a compatible manifest entry and compatible SQL', () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'migration-check-'),
    );
    fs.writeFileSync(
      path.join(directory, '0030_add_interest.sql'),
      'ALTER TABLE user ADD interest TEXT;',
    );
    fs.writeFileSync(
      path.join(directory, '0031_remove_city.sql'),
      'ALTER TABLE user DROP COLUMN city;',
    );
    const manifest = {
      '0030_add_interest': 'compatible',
      '0031_remove_city': 'irreversible',
    };
    expect(
      validatePendingMigrations({
        pending: ['0030_add_interest'],
        migrationsDirectory: directory,
        manifest,
      }),
    ).toEqual({ pending: ['0030_add_interest'], compatible: true });
    expect(() =>
      validatePendingMigrations({
        pending: ['0031_remove_city'],
        migrationsDirectory: directory,
        manifest,
      }),
    ).toThrow('irreversible SQL detected');
  });

  it('requires one manifest entry for every migration file', () => {
    const directory = fs.mkdtempSync(
      path.join(os.tmpdir(), 'migration-coverage-'),
    );
    fs.writeFileSync(path.join(directory, '0030_add_interest.sql'), '');
    expect(() =>
      validateManifestCoverage({
        migrationsDirectory: directory,
        manifest: {},
      }),
    ).toThrow('missing: 0030_add_interest');
  });
});
