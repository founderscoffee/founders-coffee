import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

import { validateReleaseState } from './release-state-core.mjs';

const execFileAsync = promisify(execFile);
const repositoryRoot = process.cwd();
const workerKeys = ['ui', 'dashboard', 'admin', 'workerJobs'];
const workerConfigs = {
  ui: 'apps/ui/wrangler.jsonc',
  dashboard: 'apps/dashboard/wrangler.jsonc',
  admin: 'apps/admin/wrangler.jsonc',
  workerJobs: 'apps/worker-jobs/wrangler.jsonc',
};
const temporaryRoot = path.join(
  '/tmp',
  `founders-coffee-rollback-${Date.now()}`,
);

const runGh = async (args, options = {}) => {
  const { stdout } = await execFileAsync('gh', args, {
    cwd: repositoryRoot,
    maxBuffer: 2 * 1024 * 1024,
    ...options,
  });
  return stdout.trim();
};

const runCommand = async (command, args, options = {}) => {
  const { stdout } = await execFileAsync(command, args, {
    cwd: repositoryRoot,
    maxBuffer: 2 * 1024 * 1024,
    ...options,
  });
  return stdout.trim();
};

const requireAuth = async () => {
  await runGh(['auth', 'status']);
};

const requireConfirmation = async () => {
  if (process.argv.includes('--yes')) return;
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      'Staging rollback drill requires an interactive confirmation',
    );
  }
  const prompt = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await prompt.question(
    'This deploys, rolls back, and redeploys staging. Type ROLLBACK STAGING to continue: ',
  );
  prompt.close();
  if (answer.trim() !== 'ROLLBACK STAGING') {
    throw new Error('Staging rollback drill cancelled');
  }
};

const workflowRunId = (output) => {
  const match = output.match(/\/actions\/runs\/(\d+)/u);
  if (!match) throw new Error('GitHub did not return a workflow run URL');
  return match[1];
};

const dispatchAndWatch = async (workflow, fields) => {
  const dispatchOutput = await runGh([
    'workflow',
    'run',
    workflow,
    '--ref',
    'develop',
    ...fields.flatMap(([key, value]) => ['--raw-field', `${key}=${value}`]),
  ]);
  const runId = workflowRunId(dispatchOutput);
  process.stdout.write(`Watching ${workflow} run ${runId}\n`);
  await runGh([
    'run',
    'watch',
    runId,
    '--compact',
    '--exit-status',
    '--interval',
    '10',
  ]);
  return runId;
};

const findStateFile = (directory) => {
  const files = [];
  const visit = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) visit(fullPath);
      else if (entry.name === 'staging.json') files.push(fullPath);
    }
  };
  visit(directory);
  if (files.length !== 1)
    throw new Error('Expected exactly one staging rollback-state file');
  return files[0];
};

const downloadState = async (runId) => {
  const directory = path.join(temporaryRoot, 'state');
  fs.mkdirSync(directory, { recursive: true });
  const artifact = `rollback-state-staging-${await runGh([
    'run',
    'view',
    runId,
    '--json',
    'headSha',
    '--jq',
    '.headSha',
  ])}`;
  await runGh([
    'run',
    'download',
    runId,
    '--name',
    artifact,
    '--dir',
    directory,
  ]);
  return JSON.parse(fs.readFileSync(findStateFile(directory), 'utf8'));
};

const rollbackFields = (state) =>
  workerKeys.map((key) => [
    key === 'workerJobs' ? 'worker_jobs_version' : `${key}_version`,
    state.workers[key].versionId,
  ]);

const rollbackWorkflowUnavailable = (error) =>
  error instanceof Error &&
  /HTTP 404: workflow rollback\.yml not found on the default branch/u.test(
    error.message,
  );

const verifyLocalRollbackTargets = async (state) => {
  await runCommand('node', [
    'tools/deploy/release-state.mjs',
    'verify-targets',
    '--environment',
    'staging',
    ...rollbackFields(state).flatMap(([key, value]) => [
      `--${key.replaceAll('_', '-')}`,
      value,
    ]),
  ]);
};

const rollbackWorkersLocally = async (state) => {
  await verifyLocalRollbackTargets(state);
  for (const key of workerKeys) {
    const worker = state.workers[key];
    await runCommand('npx', [
      '--no-install',
      'wrangler',
      'rollback',
      worker.versionId,
      '--config',
      workerConfigs[key],
      '--env',
      'staging',
      '--yes',
      '--message',
      'P0-020 staging rollback drill',
    ]);
  }
  const smokeDirectory = path.join(temporaryRoot, 'rollback-smoke');
  fs.mkdirSync(smokeDirectory, { recursive: true });
  await runCommand('node', [
    'tools/seo/smoke.mjs',
    '--origin',
    'https://staging.founders.coffee',
    '--canonical-origin',
    'https://staging.founders.coffee',
    '--output',
    path.join(smokeDirectory, 'seo-route-report.json'),
    '--sitemap-output',
    path.join(smokeDirectory, 'sitemap.xml'),
  ]);
};

const rollbackStaging = async (state) => {
  try {
    await dispatchAndWatch('rollback.yml', [
      ['environment', 'staging'],
      ...rollbackFields(state),
    ]);
  } catch (error) {
    if (!rollbackWorkflowUnavailable(error)) throw error;
    process.stdout.write(
      'rollback.yml is not on the default branch; using the local Wrangler staging fallback\n',
    );
    await rollbackWorkersLocally(state);
  }
};

const main = async () => {
  await requireConfirmation();
  await requireAuth();
  fs.mkdirSync(temporaryRoot, { recursive: true });
  const deployRun = await dispatchAndWatch('deploy.yml', [
    ['environment', 'staging'],
  ]);
  const state = await downloadState(deployRun);
  validateReleaseState(state);
  process.stdout.write(
    'Captured rollback state is valid; rollback will leave D1 untouched\n',
  );
  await rollbackStaging(state);
  process.stdout.write(
    'Staging rollback drill passed; restoring latest code\n',
  );
  await dispatchAndWatch('deploy.yml', [['environment', 'staging']]);
  process.stdout.write('Staging rollback drill completed successfully\n');
};

try {
  await main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : 'Staging drill failed'}\n`,
  );
  process.exitCode = 1;
}
