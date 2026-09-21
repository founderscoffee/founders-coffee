import { execFileSync } from 'node:child_process';
import path from 'node:path';

import { ACCOUNT_ROWS } from './rows.mjs';
import { seedStatements } from './statements.mjs';

const WORKER = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  'apps/worker-jobs',
);
const DATABASE = 'founders-coffee-db-staging';

/*
 * Refuse anything that could reach a deployed database.
 *
 * The local binding in apps/worker-jobs/wrangler.jsonc carries `"database_id": "LOCAL_DEV_ONLY"`
 * and the deployed ones live under `--env staging` / `--env production`, so `--local` with no
 * `--env` cannot resolve to either. That is the mechanism; this is the guard that stops someone
 * reaching past it from the command line, because a seed that writes invented accounts into a real
 * database is not a mistake anyone gets to make twice.
 */
const refuseRemote = (argv) => {
  const forbidden = argv.filter(
    (arg) => arg === '--remote' || arg === '--env' || arg.startsWith('--env='),
  );
  if (forbidden.length > 0)
    throw new Error(
      `dev-seed only ever writes to the local database; refusing ${forbidden.join(' ')}`,
    );
};

/**
 * Run one statement through the same wrangler path the migrations use.
 *
 * @param {string} sql a single statement.
 * @returns {void}
 */
const execute = (sql) => {
  execFileSync(
    'npx',
    [
      'wrangler',
      'd1',
      'execute',
      DATABASE,
      '--local',
      '--persist-to',
      '../../.wrangler/state',
      '--command',
      sql,
    ],
    { cwd: WORKER, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );
};

const main = () => {
  refuseRemote(process.argv.slice(2));

  const now = Math.floor(Date.now() / 1000);
  const statements = seedStatements(now);

  for (const statement of statements) execute(statement);

  const emails = ACCOUNT_ROWS.map((account) => account.email).join(', ');
  process.stdout.write(
    `seeded ${statements.length} statements into the local ${DATABASE}\n` +
      `accounts: ${emails}\n` +
      'sign in with email OTP and read the code from the dev server log\n',
  );
};

main();
