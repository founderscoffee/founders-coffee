import { describe, expect, it } from 'vitest';

import {
  REQUIRED_STAGING_JOBS,
  createGitHubRequester,
  findVerifiedStagingRun,
  hasSuccessfulStagingJobs,
  resolveReuse,
} from './verified-staging-tree.mjs';

const targetTree = 'a'.repeat(40);

const stagingRun = (overrides = {}) => ({
  conclusion: 'success',
  event: 'push',
  head_branch: 'develop',
  head_commit: { tree_id: targetTree },
  html_url: 'https://github.com/example/repo/actions/runs/42',
  id: 42,
  status: 'completed',
  updated_at: '2026-09-15T16:00:00Z',
  ...overrides,
});

const currentRun = (overrides = {}) => ({
  created_at: '2026-09-15T16:15:00Z',
  event: 'push',
  head_branch: 'main',
  head_commit: { tree_id: targetTree },
  head_sha: 'c'.repeat(40),
  ...overrides,
});

const successfulJobs = () =>
  REQUIRED_STAGING_JOBS.map((name) => ({
    conclusion: 'success',
    name,
    status: 'completed',
  }));

const resolveProductionReuse = (overrides = {}) =>
  resolveReuse({
    eventName: 'push',
    getCurrentRun: async () => currentRun(),
    getJobs: async () => ({ jobs: successfulJobs() }),
    getRuns: async () => ({ workflow_runs: [stagingRun()] }),
    sourceBranch: 'develop',
    targetBranch: 'main',
    targetSha: currentRun().head_sha,
    targetTree,
    ...overrides,
  });

describe('hasSuccessfulStagingJobs', () => {
  it('requires every long-check and staging deployment job to pass', () => {
    expect(hasSuccessfulStagingJobs(successfulJobs())).toBe(true);
    expect(hasSuccessfulStagingJobs(successfulJobs().slice(1))).toBe(false);
    expect(
      hasSuccessfulStagingJobs([
        ...successfulJobs().slice(0, 2),
        { ...successfulJobs()[2], conclusion: 'skipped' },
      ]),
    ).toBe(false);
  });
});

describe('findVerifiedStagingRun', () => {
  it('selects an exact-tree successful staging deployment', async () => {
    const run = await findVerifiedStagingRun({
      currentRunCreatedAt: currentRun().created_at,
      getJobs: async () => ({ jobs: successfulJobs() }),
      runs: [stagingRun()],
      sourceBranch: 'develop',
      targetTree,
    });

    expect(run?.id).toBe(42);
  });

  it('rejects matching trees without all required job evidence', async () => {
    const run = await findVerifiedStagingRun({
      currentRunCreatedAt: currentRun().created_at,
      getJobs: async () => ({ jobs: successfulJobs().slice(0, 2) }),
      runs: [stagingRun()],
      sourceBranch: 'develop',
      targetTree,
    });

    expect(run).toBeNull();
  });

  it('does not treat a successful run from another branch or tree as proof', async () => {
    const run = await findVerifiedStagingRun({
      currentRunCreatedAt: currentRun().created_at,
      getJobs: async () => ({ jobs: successfulJobs() }),
      runs: [
        stagingRun({ head_branch: 'main' }),
        stagingRun({ head_commit: { tree_id: 'b'.repeat(40) } }),
      ],
      sourceBranch: 'develop',
      targetTree,
    });

    expect(run).toBeNull();
  });
});

describe('resolveReuse', () => {
  it('reuses only an exact, fully verified staging tree for a production main push', async () => {
    await expect(resolveProductionReuse()).resolves.toMatchObject({
      reason: 'verified_staging_tree',
      reuse: true,
      tree: targetTree,
    });
  });

  it.each([
    ['workflow_dispatch', 'main', 'not_a_push'],
    ['push', 'develop', 'not_main'],
  ])(
    'keeps full verification for %s on %s',
    async (eventName, targetBranch, reason) => {
      await expect(
        resolveProductionReuse({ eventName, targetBranch }),
      ).resolves.toEqual({ reason, reuse: false });
    },
  );

  it('fails closed when GitHub lookup fails', async () => {
    await expect(
      resolveProductionReuse({
        getRuns: async () => {
          throw new Error('network error');
        },
      }),
    ).resolves.toEqual({ reason: 'lookup_failed', reuse: false });
  });

  it('fails closed when the GitHub token is unavailable', async () => {
    const requester = createGitHubRequester({ token: '' });

    await expect(
      resolveProductionReuse({
        getCurrentRun: () => requester('https://api.github.com/example'),
      }),
    ).resolves.toEqual({ reason: 'lookup_failed', reuse: false });
  });

  it('rejects staging evidence that completed after the current deployment began', async () => {
    await expect(
      resolveProductionReuse({
        getRuns: async () => ({
          workflow_runs: [stagingRun({ updated_at: '2026-09-15T16:16:00Z' })],
        }),
      }),
    ).resolves.toEqual({ reason: 'no_verified_staging_tree', reuse: false });
  });

  it('fails closed when the current run does not match the pushed main tree', async () => {
    await expect(
      resolveProductionReuse({
        getCurrentRun: async () => currentRun({ head_branch: 'develop' }),
      }),
    ).resolves.toEqual({ reason: 'current_run_mismatch', reuse: false });
  });
});
