import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';

import {
  ENVIRONMENT_CONFIG,
  extractActiveVersion,
  extractBookmark,
  hasVersionId,
  latestMigration,
  validateReleaseState,
  validateRollbackRequest,
} from './release-state.mjs';

const version = 'a'.repeat(32);
const bookmark = 'bookmark-v1:example';

const releaseState = (overrides = {}) => ({
  schemaVersion: 1,
  capturedAt: '2026-09-16T07:00:00.000Z',
  commitSha: 'b'.repeat(40),
  environment: 'staging',
  migrationHead: '0030_white_vindicator',
  database: {
    name: ENVIRONMENT_CONFIG.staging.database,
    bookmark,
  },
  workers: Object.fromEntries(
    Object.entries(ENVIRONMENT_CONFIG.staging.workers).map(([key, name]) => [
      key,
      {
        name,
        deploymentId: 'c'.repeat(32),
        versionId: version,
        percentage: 100,
      },
    ]),
  ),
  ...overrides,
});

describe('release state extraction', () => {
  it('selects the 100 percent version from Wrangler deployment JSON', () => {
    expect(
      extractActiveVersion(
        {
          result: [
            {
              id: 'deployment-1',
              created_on: '2026-09-15T09:00:00.000Z',
              versions: [{ percentage: 100, version_id: 'd'.repeat(32) }],
            },
            {
              id: 'deployment-2',
              created_on: '2026-09-16T09:00:00.000Z',
              versions: [{ percentage: 100, version_id: version }],
            },
          ],
        },
        'founders-coffee-ui-staging',
      ),
    ).toEqual({
      deploymentId: 'deployment-2',
      percentage: 100,
      versionId: version,
    });
  });

  it('rejects a deployment without an unambiguous active version', () => {
    expect(() =>
      extractActiveVersion(
        {
          result: [
            {
              versions: [
                { percentage: 50, version_id: version },
                { percentage: 50, version_id: 'd'.repeat(32) },
              ],
            },
          ],
        },
        'worker',
      ),
    ).toThrow('active version');
  });

  it('fails closed when multiple deployments have no timestamps', () => {
    expect(() =>
      extractActiveVersion(
        {
          result: [
            { versions: [{ percentage: 100, version_id: version }] },
            { versions: [{ percentage: 100, version_id: 'd'.repeat(32) }] },
          ],
        },
        'worker',
      ),
    ).toThrow('no timestamps');
  });

  it('finds a bookmark in either a direct or nested response', () => {
    expect(extractBookmark({ bookmark })).toBe(bookmark);
    expect(extractBookmark({ result: { bookmark } })).toBe(bookmark);
  });

  it('checks a rollback version against deployment history', () => {
    expect(
      hasVersionId(
        { result: [{ versions: [{ version_id: version }] }] },
        version,
      ),
    ).toBe(true);
    expect(
      hasVersionId(
        { result: [{ versions: [{ version_id: 'd'.repeat(32) }] }] },
        version,
      ),
    ).toBe(false);
  });
});

describe('release state validation', () => {
  it('accepts a complete environment snapshot', () => {
    expect(validateReleaseState(releaseState())).toMatchObject({
      environment: 'staging',
    });
  });

  it('rejects an environment-mismatched database or worker', () => {
    expect(() =>
      validateReleaseState(
        releaseState({ database: { name: 'wrong', bookmark } }),
      ),
    ).toThrow('database does not match');
    expect(() =>
      validateReleaseState(
        releaseState({
          workers: {
            ...releaseState().workers,
            ui: { name: 'wrong', versionId: version, percentage: 100 },
          },
        }),
      ),
    ).toThrow('Worker does not match');
  });

  it('records the current migration head from the committed migration directory', () => {
    expect(
      latestMigration(
        fileURLToPath(new URL('../../libs/db/migrations', import.meta.url)),
      ),
    ).toBe('0032_follow_up_prompts_default_on');
  });
});

describe('rollback request validation', () => {
  const versions = Object.fromEntries(
    Object.keys(ENVIRONMENT_CONFIG.production.workers).map((key) => [
      key,
      version,
    ]),
  );

  it('requires every Worker version and allows a Worker-only rollback', () => {
    expect(
      validateRollbackRequest({
        environment: 'production',
        versions,
      }),
    ).toEqual({ environment: 'production' });
  });

  it('rejects database restore options', () => {
    expect(() =>
      validateRollbackRequest({
        environment: 'production',
        versions,
        restoreDatabase: true,
      }),
    ).toThrow('D1 restore is not part');
  });
});
