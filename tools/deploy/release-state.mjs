import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

import {
  ENVIRONMENT_CONFIG,
  extractActiveVersion,
  extractBookmark,
  hasVersionId,
  latestMigration,
  RELEASE_STATE_VERSION,
  validateReleaseState,
  validateRollbackRequest,
} from './release-state-core.mjs';

export {
  ENVIRONMENT_CONFIG,
  extractActiveVersion,
  extractBookmark,
  hasVersionId,
  latestMigration,
  RELEASE_STATE_VERSION,
  validateReleaseState,
  validateRollbackRequest,
};

const execFileAsync = promisify(execFile);

const parseJsonOutput = (output) => {
  // eslint-disable-next-line no-control-regex -- strip ANSI escape sequences from Wrangler output
  const clean = output.replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, '').trim();
  try {
    return JSON.parse(clean);
  } catch {
    const start = Math.min(
      ...['{', '['].map((token) => {
        const index = clean.indexOf(token);
        return index === -1 ? Number.POSITIVE_INFINITY : index;
      }),
    );
    if (!Number.isFinite(start))
      throw new Error('Wrangler returned invalid JSON');
    return JSON.parse(clean.slice(start));
  }
};

const runWrangler = async (args) => {
  const { stdout, stderr } = await execFileAsync('npx', ['wrangler', ...args], {
    cwd: process.cwd(),
    env: { ...process.env, CI: '1' },
    maxBuffer: 1024 * 1024,
  });
  if (stderr && !stdout) throw new Error(stderr.trim().slice(0, 400));
  return parseJsonOutput(stdout);
};

export const captureReleaseState = async ({
  environment,
  output,
  rootDirectory = process.cwd(),
}) => {
  if (!Object.hasOwn(ENVIRONMENT_CONFIG, environment)) {
    throw new Error(`Unsupported environment: ${environment}`);
  }
  if (typeof output !== 'string' || output.length === 0)
    throw new Error('output is required');
  const config = ENVIRONMENT_CONFIG[environment];
  const [databasePayload, ...deploymentPayloads] = await Promise.all([
    runWrangler(['d1', 'time-travel', 'info', config.database, '--json']),
    ...Object.values(config.workers).map((name) =>
      runWrangler(['deployments', 'list', '--name', name, '--json']),
    ),
  ]);
  const workers = Object.fromEntries(
    Object.entries(config.workers).map(([key, name], index) => [
      key,
      { name, ...extractActiveVersion(deploymentPayloads[index], name) },
    ]),
  );
  const state = validateReleaseState({
    schemaVersion: RELEASE_STATE_VERSION,
    capturedAt: new Date().toISOString(),
    commitSha: process.env.GITHUB_SHA ?? null,
    environment,
    migrationHead: latestMigration(
      path.join(rootDirectory, 'libs', 'db', 'migrations'),
    ),
    database: {
      name: config.database,
      bookmark: extractBookmark(databasePayload),
    },
    workers,
  });
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const temporary = `${output}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
  fs.renameSync(temporary, output);
  return state;
};

export const verifyRollbackTargets = async ({ environment, versions }) => {
  if (!(environment in ENVIRONMENT_CONFIG)) {
    throw new Error(`Unsupported environment: ${environment}`);
  }
  const workers = Object.entries(ENVIRONMENT_CONFIG[environment].workers);
  const payloads = await Promise.all(
    workers.map(([, name]) =>
      runWrangler(['deployments', 'list', '--name', name, '--json']),
    ),
  );
  workers.forEach(([key, name], index) => {
    if (!hasVersionId(payloads[index], versions?.[key])) {
      throw new Error(
        `${key} version is not present in ${name} deployment history`,
      );
    }
  });
  return true;
};

const argumentValue = (args, name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const rejectDatabaseRollbackOptions = (args) => {
  const unsupported = args.find((argument) =>
    /^(?:--restore-database|--database-bookmark|--restore-confirmation)$/u.test(
      argument,
    ),
  );
  if (unsupported)
    throw new Error(
      `${unsupported} is not supported; rollback leaves D1 untouched`,
    );
};

const main = async () => {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'capture') {
    const state = await captureReleaseState({
      environment: argumentValue(args, '--environment'),
      output: argumentValue(args, '--output'),
    });
    process.stdout.write(`Captured ${state.environment} rollback state\n`);
    return;
  }
  if (command === 'validate') {
    const file = argumentValue(args, '--file');
    if (!file) throw new Error('--file is required');
    validateReleaseState(JSON.parse(fs.readFileSync(file, 'utf8')));
    process.stdout.write('Release state is valid\n');
    return;
  }
  if (command === 'validate-rollback') {
    rejectDatabaseRollbackOptions(args);
    const versions = Object.fromEntries(
      Object.keys(ENVIRONMENT_CONFIG.staging.workers).map((key) => [
        key,
        argumentValue(
          args,
          `--${key.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}-version`,
        ),
      ]),
    );
    validateRollbackRequest({
      environment: argumentValue(args, '--environment'),
      versions,
    });
    process.stdout.write('Rollback request is valid\n');
    return;
  }
  if (command === 'verify-targets') {
    const versions = Object.fromEntries(
      Object.keys(ENVIRONMENT_CONFIG.staging.workers).map((key) => [
        key,
        argumentValue(
          args,
          `--${key.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}-version`,
        ),
      ]),
    );
    await verifyRollbackTargets({
      environment: argumentValue(args, '--environment'),
      versions,
    });
    process.stdout.write(
      'Rollback targets are present in deployment history\n',
    );
    return;
  }
  throw new Error('Usage: capture|validate|validate-rollback|verify-targets');
};

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Rollback state failed'}\n`,
    );
    process.exitCode = 1;
  }
}
