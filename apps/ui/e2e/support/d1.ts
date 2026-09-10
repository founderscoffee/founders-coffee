import { execFileSync } from 'node:child_process';

const DATABASE = process.env.E2E_D1_DATABASE ?? 'founders-coffee-db-staging';

const REMOTE = process.env.E2E_D1_MODE === 'remote';

/**
 * Run one statement against the database the app under test is actually using.
 *
 * The suite reads real rows rather than trusting the UI: an event that renders is not proof of an
 * event that persisted, and the one-time code the login step needs is only ever written to D1. The
 * same helper serves the local Miniflare database and, for the EC-10 staging smoke, the deployed
 * one — the mode is explicit so a local run can never touch a deployed database by accident.
 */
export const d1 = <T = Record<string, unknown>>(sql: string): T[] => {
  const args = [
    'wrangler',
    'd1',
    'execute',
    DATABASE,
    REMOTE ? '--remote' : '--local',
    '--json',
    '--command',
    sql,
  ];
  if (REMOTE) args.splice(5, 0, '--env', 'staging');
  const raw = execFileSync('npx', args, {
    cwd: new URL('../../', import.meta.url).pathname,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    maxBuffer: 8 * 1024 * 1024,
  });
  const start = raw.indexOf('[');
  if (start === -1)
    throw new Error(`Unexpected d1 output: ${raw.slice(0, 400)}`);
  const parsed = JSON.parse(raw.slice(start)) as { results?: T[] }[];
  return parsed[0]?.results ?? [];
};

const sqlString = (value: string): string => `'${value.replaceAll("'", "''")}'`;

export interface PersistedEvent {
  readonly id: string;
  readonly slug: string;
  readonly title: string;
  readonly description: string;
  readonly venue: string;
  readonly venue_address: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly starts_at: number;
  readonly ends_at: number | null;
  readonly language: string;
  readonly market_code: string;
  readonly state_code: string;
  readonly city_code: string;
  readonly status: string;
  readonly host_id: string;
}

export const findEventByTitle = (title: string): PersistedEvent | undefined =>
  d1<PersistedEvent>(
    `SELECT * FROM events WHERE title = ${sqlString(title)} LIMIT 1`,
  )[0];

/**
 * Remove everything one run created, addressed by the exact rows it made.
 *
 * Deleting by identifier rather than by a pattern is what makes this safe to point at a deployed
 * database: a broadened `LIKE` on a shared table is one typo away from deleting a real member's
 * event. RSVPs and sessions go first so no foreign key outlives its parent.
 */
export const cleanupRun = (opts: {
  eventIds: readonly string[];
  emails: readonly string[];
}): void => {
  for (const eventId of opts.eventIds) {
    d1(`DELETE FROM event_rsvps WHERE event_id = ${sqlString(eventId)}`);
    d1(`DELETE FROM events WHERE id = ${sqlString(eventId)}`);
  }
  for (const email of opts.emails) {
    d1(
      `DELETE FROM session WHERE user_id IN (SELECT id FROM user WHERE email = ${sqlString(email)})`,
    );
    d1(
      `DELETE FROM account WHERE user_id IN (SELECT id FROM user WHERE email = ${sqlString(email)})`,
    );
    d1(
      `DELETE FROM verification WHERE identifier LIKE '%' || ${sqlString(email)}`,
    );
    d1(`DELETE FROM user WHERE email = ${sqlString(email)}`);
  }
};
