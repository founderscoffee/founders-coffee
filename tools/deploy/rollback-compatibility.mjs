import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  listRemoteMigrations,
  resolveAppliedMigrations,
  validateManifestCoverage,
} from './migration-compatibility.mjs';
import {
  ENVIRONMENT_CONFIG,
  validateReleaseState,
} from './release-state-core.mjs';

const migrationDirectory = path.join('libs', 'db', 'migrations');

/*
 * Migrations the database has run since the requested Worker versions were the live ones, kept
 * only when the manifest does not call them `compatible`. Those are exactly the schema changes
 * the restored code was never written against: dropped columns it still selects, renamed tables
 * it still writes. A `compatible` migration is one the manifest promises older code survives.
 */
export const findBlockingMigrations = ({
  appliedAtVersion,
  appliedNow,
  manifest,
}) => {
  const shipped = new Set(appliedAtVersion);
  return appliedNow
    .filter((name) => !shipped.has(name) && manifest[name] !== 'compatible')
    .map((name) => ({ migration: name, mode: manifest[name] ?? 'missing' }));
};

const requireStateForVersions = ({ state, environment, versions }) => {
  validateReleaseState(state);
  if (state.environment !== environment) {
    throw new Error(
      `Rollback state describes ${state.environment}, not ${environment}`,
    );
  }
  const mismatched = Object.keys(
    ENVIRONMENT_CONFIG[environment].workers,
  ).filter((key) => state.workers[key].versionId !== versions[key]);
  if (mismatched.length > 0) {
    throw new Error(
      `Rollback state does not describe the requested versions (${mismatched.join(', ')}); supply the deploy run whose artifact produced them`,
    );
  }
  return state;
};

const blockedMessage = (blocking) =>
  [
    `Rollback refused: the requested Worker versions predate ${blocking.length} migration(s) the compatibility manifest does not mark compatible:`,
    ...blocking.map(
      ({ migration, mode }) => `- ${migration}: manifest mode is ${mode}`,
    ),
    'Rolling back the Workers alone would run that code against a schema it was never written for. Re-run with acknowledge_migration_risk to proceed anyway.',
  ].join('\n');

/*
 * The manifest is only a claim until something refuses to act against it. The deploy gate
 * refuses to move the schema past code that cannot follow; this refuses the mirror image -
 * moving code back behind a schema that already has.
 */
export const assertRollbackAllowed = ({
  state,
  environment,
  versions,
  appliedNow,
  manifest,
  isAcknowledged = false,
}) => {
  if (!state) {
    if (isAcknowledged) return { blocking: [], evidence: 'unverified' };
    throw new Error(
      'Rollback refused: no rollback-state artifact says which migrations these Worker versions shipped with. Supply rollback_state_run_id, or set acknowledge_migration_risk to roll back without that evidence.',
    );
  }
  const matched = requireStateForVersions({ state, environment, versions });
  const blocking = findBlockingMigrations({
    appliedAtVersion: matched.appliedMigrations,
    appliedNow,
    manifest,
  });
  if (blocking.length === 0) return { blocking, evidence: 'verified' };
  if (isAcknowledged) return { blocking, evidence: 'acknowledged' };
  throw new Error(blockedMessage(blocking));
};

const checkSummary = ({ evidence, blocking }) => {
  if (evidence === 'verified') {
    return 'Rollback compatibility check passed: no migration applied since these versions is outside the manifest';
  }
  if (evidence === 'unverified') {
    return 'Rollback compatibility check acknowledged: rolling back with no artifact saying which migrations these versions shipped with';
  }
  return `Rollback compatibility check acknowledged: rolling back past ${blocking.length} migration(s) the manifest does not mark compatible`;
};

export const checkRollbackCompatibility = async ({
  environment,
  versions,
  stateFile,
  isAcknowledged = false,
  migrationsDirectory = migrationDirectory,
}) => {
  if (!Object.hasOwn(ENVIRONMENT_CONFIG, environment)) {
    throw new Error(`Unsupported environment: ${environment}`);
  }
  const state = stateFile
    ? JSON.parse(fs.readFileSync(stateFile, 'utf8'))
    : undefined;
  const manifest = validateManifestCoverage({ migrationsDirectory });
  const appliedNow = state
    ? resolveAppliedMigrations({
        output: await listRemoteMigrations(environment),
        migrationsDirectory,
      })
    : [];
  const result = assertRollbackAllowed({
    state,
    environment,
    versions,
    appliedNow,
    manifest,
    isAcknowledged,
  });
  process.stdout.write(`${checkSummary(result)}\n`);
  return result;
};

const argumentValue = (args, name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const versionFlag = (key) =>
  `--${key.replace(/[A-Z]/gu, (letter) => `-${letter.toLowerCase()}`)}-version`;

const main = async () => {
  const [command, ...args] = process.argv.slice(2);
  if (command !== 'check') {
    throw new Error(
      'Usage: check --environment <staging|production> [--state-file <path>] [--acknowledge]',
    );
  }
  await checkRollbackCompatibility({
    environment: argumentValue(args, '--environment'),
    versions: Object.fromEntries(
      Object.keys(ENVIRONMENT_CONFIG.staging.workers).map((key) => [
        key,
        argumentValue(args, versionFlag(key)),
      ]),
    ),
    stateFile: argumentValue(args, '--state-file'),
    isAcknowledged: args.includes('--acknowledge'),
  });
};

if (
  process.argv[1] &&
  pathToFileURL(process.argv[1]).href === import.meta.url
) {
  try {
    await main();
  } catch (error) {
    process.stderr.write(
      `${error instanceof Error ? error.message : 'Rollback compatibility check failed'}\n`,
    );
    process.exitCode = 1;
  }
}
