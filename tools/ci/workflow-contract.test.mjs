import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = (name) =>
  fs.readFileSync(
    path.join(import.meta.dirname, '..', '..', '.github', 'workflows', name),
    'utf8',
  );

const packageManifest = JSON.parse(
  fs.readFileSync(
    path.join(import.meta.dirname, '..', '..', 'package.json'),
    'utf8',
  ),
);

const ciWorkflow = workflow('ci.yml');
const deployWorkflow = workflow('deploy.yml');
const rollbackWorkflow = workflow('rollback.yml');
const titleWorkflow = workflow('pull-request-title.yml');
const stagingDrill = fs.readFileSync(
  path.join(import.meta.dirname, '..', 'deploy', 'staging-rollback-drill.mjs'),
  'utf8',
);

describe('verified staging tree workflow contract', () => {
  it('does not accept caller-controlled reuse evidence', () => {
    expect(ciWorkflow).not.toContain('reuse_verified_staging_tree');
    expect(ciWorkflow).not.toContain('verified_source_run_url');
    expect(ciWorkflow).not.toContain('verified_source_tree');
  });

  it('requires internally generated evidence before it skips long verification', () => {
    expect(ciWorkflow).toContain(
      "needs.reuse-evidence.outputs.reuse != 'true'",
    );
    expect(ciWorkflow).toContain(
      'REUSE_EVIDENCE: ${{ needs.reuse-evidence.result }}',
    );
  });

  it('grants the reusable workflow only the read access its lookup needs', () => {
    expect(deployWorkflow).toContain('actions: read');
    expect(deployWorkflow).toContain('uses: ./.github/workflows/ci.yml');
  });
});

describe('rollback workflow contract', () => {
  it('exposes the guarded staging drill as one npm command', () => {
    expect(packageManifest.scripts['rollback:staging']).toBe(
      'node tools/deploy/staging-rollback-drill.mjs',
    );
  });

  it('captures state before migration and exposes the recovery artifact', () => {
    expect(deployWorkflow).toContain('Capture rollback state');
    expect(deployWorkflow).toContain('tools/deploy/release-state.mjs capture');
    expect(deployWorkflow).toContain(
      'rollback-state-${{ env.TARGET_ENV }}-${{ github.sha }}',
    );
    expect(deployWorkflow.indexOf('Capture rollback state')).toBeLessThan(
      deployWorkflow.indexOf('Apply D1 migrations'),
    );
  });

  it('requires all Worker versions and keeps D1 restore out of normal rollback', () => {
    for (const input of [
      'ui_version',
      'dashboard_version',
      'admin_version',
      'worker_jobs_version',
    ]) {
      expect(rollbackWorkflow).toContain(`${input}:`);
    }
    expect(rollbackWorkflow).toContain('validate-rollback');
    expect(rollbackWorkflow).toContain('wrangler rollback');
    for (const config of [
      'apps/ui/wrangler.jsonc',
      'apps/dashboard/wrangler.jsonc',
      'apps/admin/wrangler.jsonc',
      'apps/worker-jobs/wrangler.jsonc',
    ]) {
      expect(rollbackWorkflow).toContain(`--config ${config}`);
    }
    expect(rollbackWorkflow).not.toContain('time-travel restore');
    expect(rollbackWorkflow).not.toContain('restore_database');
  });

  it('requires explicit opt-in for the pre-default-branch local escape hatch', () => {
    expect(stagingDrill).toContain('local Wrangler staging fallback');
    expect(stagingDrill).toContain("process.argv.includes('--local-fallback')");
    expect(stagingDrill).toContain(
      'rollback.yml must be present on the repository default branch',
    );
    expect(stagingDrill).toContain('actions/workflows/rollback.yml');
    expect(stagingDrill).toContain("'wrangler'");
    expect(stagingDrill).toContain("'https://staging.founders.coffee'");
    expect(stagingDrill).not.toContain('time-travel restore');
  });

  it('reads the migration list the deploy captured before it migrated', () => {
    expect(deployWorkflow).toContain('tools/deploy/release-state.mjs capture');
    expect(rollbackWorkflow).toContain('rollback_state_run_id');
    expect(rollbackWorkflow).toContain('rollback-state-$TARGET_ENV-$head_sha');
    expect(deployWorkflow).toContain(
      'rollback-state-${{ env.TARGET_ENV }}-${{ github.sha }}',
    );
    expect(rollbackWorkflow).toContain('actions: read');
  });

  it('clears the target versions against the manifest before any Worker rollback', () => {
    expect(rollbackWorkflow).toContain(
      'tools/deploy/rollback-compatibility.mjs check',
    );
    expect(rollbackWorkflow).toContain('acknowledge_migration_risk');
    expect(
      rollbackWorkflow.indexOf('rollback-compatibility.mjs check'),
    ).toBeLessThan(rollbackWorkflow.indexOf('Roll back UI Worker'));
  });

  it('makes the staging drill exercise that gate on both of its paths', () => {
    expect(stagingDrill).toContain("['rollback_state_run_id', deployRun]");
    expect(stagingDrill).toContain(
      "'tools/deploy/rollback-compatibility.mjs',",
    );
  });

  it('runs smoke verification only after every Worker rollback', () => {
    expect(rollbackWorkflow).toContain('Roll back worker-jobs Worker');
    expect(rollbackWorkflow).toContain('Run SEO route smoke');
    expect(
      rollbackWorkflow.indexOf('Roll back worker-jobs Worker'),
    ).toBeLessThan(rollbackWorkflow.indexOf('Run SEO route smoke'));
  });

  it('blocks unreviewed migrations before D1 migration apply', () => {
    expect(deployWorkflow).toContain(
      'tools/deploy/migration-compatibility.mjs check',
    );
    expect(
      deployWorkflow.indexOf('migration-compatibility.mjs check'),
    ).toBeLessThan(deployWorkflow.indexOf('Apply D1 migrations'));
  });
});

describe('pull request gate contract', () => {
  const RELEASE_PULL_REQUEST =
    "github.event_name == 'pull_request' && github.base_ref == 'main' && github.head_ref == 'develop' && github.event.pull_request.head.repo.full_name == github.repository";

  it('runs on every pull request, so the required checks always report', () => {
    for (const gate of [ciWorkflow, titleWorkflow]) {
      expect(gate).not.toContain('paths-ignore');
      expect(gate).not.toMatch(/^\s+paths:/mu);
    }
  });

  it("skips long verification only for this repository's develop into main", () => {
    expect(ciWorkflow.split(RELEASE_PULL_REQUEST)).toHaveLength(4);
    expect(
      ciWorkflow,
      'a fork can name its branch develop, so a head ref alone must not skip the gates',
    ).not.toContain("github.head_ref != 'develop'");
  });

  it('checks a contributor title through the environment, never inside the script', () => {
    expect(titleWorkflow).toContain(
      'PULL_REQUEST_TITLE: ${{ github.event.pull_request.title }}',
    );
    expect(titleWorkflow).not.toMatch(
      /run:[^\n]*github\.event\.pull_request\.title/,
    );
    expect(titleWorkflow).toContain(
      'run: node tools/ci/pull-request-title.mjs',
    );
  });

  it('checks the title again when it is edited and on every new commit', () => {
    expect(
      titleWorkflow,
      'a rerun replays the old title, so only an edited event sees the new one',
    ).toContain('types: [opened, edited, reopened, synchronize]');
    expect(titleWorkflow).toContain('branches: [develop]');
  });

  it('reports under the name the develop ruleset requires', () => {
    expect(titleWorkflow).toContain('    name: Pull request title\n');
  });
});

describe('local development contract', () => {
  it.each(['ui:dev', 'admin:dev', 'worker-jobs:dev'])(
    '%s compiles the i18n messages before it starts a Worker that imports them',
    (script) => {
      const command = packageManifest.scripts[script];

      expect(
        command,
        'the compiled messages are gitignored, so a fresh clone has none until they are generated',
      ).toContain('nx run i18n:generate-i18n && npm -w apps/');
    },
  );
});
