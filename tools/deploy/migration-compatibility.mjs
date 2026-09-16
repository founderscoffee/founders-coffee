import fs from 'node:fs';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const migrationDirectory = path.join('libs', 'db', 'migrations');
const manifestPath = path.join(migrationDirectory, 'compatibility.json');
const migrationNamePattern = /\b(\d{4}_[a-z0-9_]+)(?:\.sql)?\b/giu;
const irreversiblePatterns = [
  /\bDROP\s+(?:TABLE|COLUMN|INDEX)\b/iu,
  /\bDELETE\s+FROM\b/iu,
  /\bALTER\s+TABLE\b[^;]*\bRENAME\b/iu,
];

export const parsePendingMigrations = (output) => [
  ...new Set(
    [...output.matchAll(migrationNamePattern)].map((match) => match[1]),
  ),
];

export const findIrreversibleStatements = (sql) =>
  irreversiblePatterns
    .filter((pattern) => pattern.test(sql))
    .map((pattern) => pattern.source);

export const loadCompatibilityManifest = (file = manifestPath) =>
  JSON.parse(fs.readFileSync(file, 'utf8'));

export const validateManifestCoverage = ({
  migrationsDirectory = migrationDirectory,
  manifest = loadCompatibilityManifest(
    path.join(migrationsDirectory, 'compatibility.json'),
  ),
}) => {
  const migrationNames = fs
    .readdirSync(migrationsDirectory)
    .filter((file) => /^\d{4}_.+\.sql$/u.test(file))
    .map((file) => file.replace(/\.sql$/u, ''));
  const missing = migrationNames.filter(
    (name) => !Object.hasOwn(manifest, name),
  );
  const unknown = Object.keys(manifest).filter(
    (name) => !migrationNames.includes(name),
  );
  if (missing.length > 0 || unknown.length > 0) {
    const details = [
      ...(missing.length > 0 ? [`missing: ${missing.join(', ')}`] : []),
      ...(unknown.length > 0 ? [`unknown: ${unknown.join(', ')}`] : []),
    ];
    throw new Error(
      `Migration compatibility manifest does not match migration files (${details.join('; ')})`,
    );
  }
  return manifest;
};

export const validatePendingMigrations = ({
  pending,
  migrationsDirectory = migrationDirectory,
  manifest = loadCompatibilityManifest(
    path.join(migrationsDirectory, 'compatibility.json'),
  ),
}) => {
  validateManifestCoverage({ migrationsDirectory, manifest });
  const failures = [];
  for (const migration of pending) {
    const mode = manifest[migration];
    const file = path.join(migrationsDirectory, `${migration}.sql`);
    if (mode !== 'compatible') {
      failures.push(
        `${migration}: manifest mode is ${mode ?? 'missing'}; automatic rollback is not allowed`,
      );
    }
    if (!fs.existsSync(file)) {
      failures.push(`${migration}: migration file is missing`);
      continue;
    }
    const reasons = findIrreversibleStatements(fs.readFileSync(file, 'utf8'));
    if (reasons.length > 0) {
      failures.push(`${migration}: irreversible SQL detected`);
    }
  }
  if (failures.length > 0) {
    throw new Error(
      `Migration compatibility check failed:\n${failures.map((failure) => `- ${failure}`).join('\n')}`,
    );
  }
  return { pending, compatible: true };
};

const runWrangler = async (environment) => {
  const database = `founders-coffee-db-${environment}`;
  const { stdout, stderr } = await execFileAsync(
    'npx',
    [
      'wrangler',
      '--config',
      'apps/worker-jobs/wrangler.jsonc',
      'd1',
      'migrations',
      'list',
      database,
      '--remote',
      '--env',
      environment,
    ],
    {
      cwd: process.cwd(),
      env: { ...process.env, CI: '1' },
      maxBuffer: 1024 * 1024,
    },
  );
  if (!stdout && stderr) throw new Error(stderr.trim().slice(0, 400));
  return stdout;
};

export const checkRemoteMigrations = async ({ environment }) => {
  if (!['staging', 'production'].includes(environment)) {
    throw new Error(`Unsupported environment: ${environment}`);
  }
  const pending = parsePendingMigrations(await runWrangler(environment));
  const result = validatePendingMigrations({ pending });
  process.stdout.write(
    result.pending.length === 0
      ? 'Migration compatibility check passed: no pending migrations\n'
      : `Migration compatibility check passed: ${result.pending.length} pending migration(s)\n`,
  );
  return result;
};

const argumentValue = (args, name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};

const main = async () => {
  const [command, ...args] = process.argv.slice(2);
  if (command !== 'check')
    throw new Error('Usage: check --environment <staging|production>');
  await checkRemoteMigrations({
    environment: argumentValue(args, '--environment'),
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
      `${error instanceof Error ? error.message : 'Migration check failed'}\n`,
    );
    process.exitCode = 1;
  }
}
