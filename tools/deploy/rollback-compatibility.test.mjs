import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { loadCompatibilityManifest } from './migration-compatibility.mjs';
import {
  assertRollbackAllowed,
  findBlockingMigrations,
} from './rollback-compatibility.mjs';
import {
  ENVIRONMENT_CONFIG,
  RELEASE_STATE_VERSION,
} from './release-state-core.mjs';

const version = 'a'.repeat(32);
const otherVersion = 'b'.repeat(32);
const environment = 'production';
const workerKeys = Object.keys(ENVIRONMENT_CONFIG[environment].workers);

const versions = Object.fromEntries(workerKeys.map((key) => [key, version]));

const releaseState = (appliedMigrations, overrides = {}) => ({
  schemaVersion: RELEASE_STATE_VERSION,
  capturedAt: '2026-09-16T07:00:00.000Z',
  commitSha: 'c'.repeat(40),
  environment,
  migrationHead: appliedMigrations.at(-1),
  appliedMigrations,
  database: {
    name: ENVIRONMENT_CONFIG[environment].database,
    bookmark: 'bookmark-v1:example',
  },
  workers: Object.fromEntries(
    Object.entries(ENVIRONMENT_CONFIG[environment].workers).map(
      ([key, name]) => [
        key,
        {
          name,
          deploymentId: 'd'.repeat(32),
          versionId: version,
          percentage: 100,
        },
      ],
    ),
  ),
  ...overrides,
});

const manifest = {
  '0019_material_jigsaw': 'irreversible',
  '0020_profile_foundation': 'compatible',
  '0021_remove_profile_residence': 'irreversible',
  '0022_remove_photo_visibility': 'irreversible',
};

describe('blocking migration detection', () => {
  it('flags only migrations applied after the version that the manifest cannot clear', () => {
    expect(
      findBlockingMigrations({
        appliedAtVersion: ['0019_material_jigsaw', '0020_profile_foundation'],
        appliedNow: [
          '0019_material_jigsaw',
          '0020_profile_foundation',
          '0021_remove_profile_residence',
        ],
        manifest,
      }),
    ).toEqual([
      { migration: '0021_remove_profile_residence', mode: 'irreversible' },
    ]);
  });

  it('clears a version whose only newer migrations are compatible', () => {
    expect(
      findBlockingMigrations({
        appliedAtVersion: ['0019_material_jigsaw'],
        appliedNow: ['0019_material_jigsaw', '0020_profile_foundation'],
        manifest,
      }),
    ).toEqual([]);
  });

  it('ignores an irreversible migration the version already shipped with', () => {
    expect(
      findBlockingMigrations({
        appliedAtVersion: ['0019_material_jigsaw'],
        appliedNow: ['0019_material_jigsaw'],
        manifest,
      }),
    ).toEqual([]);
  });

  it('treats a migration the manifest never classified as blocking', () => {
    expect(
      findBlockingMigrations({
        appliedAtVersion: [],
        appliedNow: ['0099_unlisted'],
        manifest,
      }),
    ).toEqual([{ migration: '0099_unlisted', mode: 'missing' }]);
  });
});

describe('rollback refusal', () => {
  const state = releaseState([
    '0019_material_jigsaw',
    '0020_profile_foundation',
  ]);
  const appliedNow = [
    '0019_material_jigsaw',
    '0020_profile_foundation',
    '0021_remove_profile_residence',
  ];

  it('refuses a Worker version that predates a column-dropping migration', () => {
    expect(() =>
      assertRollbackAllowed({
        state,
        environment,
        versions,
        appliedNow,
        manifest,
      }),
    ).toThrow('0021_remove_profile_residence');
  });

  it('proceeds past the same migration when the run explicitly acknowledges it', () => {
    expect(
      assertRollbackAllowed({
        state,
        environment,
        versions,
        appliedNow,
        manifest,
        isAcknowledged: true,
      }),
    ).toEqual({
      blocking: [
        { migration: '0021_remove_profile_residence', mode: 'irreversible' },
      ],
      evidence: 'acknowledged',
    });
  });

  it('allows a rollback the manifest can clear', () => {
    expect(
      assertRollbackAllowed({
        state,
        environment,
        versions,
        appliedNow: ['0019_material_jigsaw', '0020_profile_foundation'],
        manifest,
      }),
    ).toEqual({ blocking: [], evidence: 'verified' });
  });

  it('refuses when no artifact says what the versions shipped with', () => {
    expect(() =>
      assertRollbackAllowed({
        state: undefined,
        environment,
        versions,
        appliedNow,
        manifest,
      }),
    ).toThrow('no rollback-state artifact');
  });

  it('allows an evidence-free rollback only when it is acknowledged', () => {
    expect(
      assertRollbackAllowed({
        state: undefined,
        environment,
        versions,
        appliedNow,
        manifest,
        isAcknowledged: true,
      }),
    ).toEqual({ blocking: [], evidence: 'unverified' });
  });

  it('rejects an artifact that describes other Worker versions, acknowledged or not', () => {
    const mismatched = {
      state,
      environment,
      versions: { ...versions, admin: otherVersion },
      appliedNow,
      manifest,
    };
    expect(() => assertRollbackAllowed(mismatched)).toThrow(
      'does not describe the requested versions (admin)',
    );
    expect(() =>
      assertRollbackAllowed({ ...mismatched, isAcknowledged: true }),
    ).toThrow('does not describe the requested versions (admin)');
  });

  it('rejects an artifact captured for the other environment', () => {
    expect(() =>
      assertRollbackAllowed({
        state: releaseState(['0019_material_jigsaw'], {
          environment: 'staging',
          database: {
            name: ENVIRONMENT_CONFIG.staging.database,
            bookmark: 'bookmark-v1:example',
          },
          workers: Object.fromEntries(
            Object.entries(ENVIRONMENT_CONFIG.staging.workers).map(
              ([key, name]) => [
                key,
                { name, versionId: version, percentage: 100 },
              ],
            ),
          ),
        }),
        environment,
        versions,
        appliedNow,
        manifest,
      }),
    ).toThrow('describes staging, not production');
  });

  it('reads the shipped manifest as refusing the migrations it labels irreversible', () => {
    const shipped = loadCompatibilityManifest(
      fileURLToPath(
        new URL('../../libs/db/migrations/compatibility.json', import.meta.url),
      ),
    );
    expect(
      findBlockingMigrations({
        appliedAtVersion: ['0020_profile_foundation'],
        appliedNow: [
          '0020_profile_foundation',
          '0021_remove_profile_residence',
          '0025_woozy_apocalypse',
        ],
        manifest: shipped,
      }),
    ).toEqual([
      { migration: '0021_remove_profile_residence', mode: 'irreversible' },
    ]);
  });
});
