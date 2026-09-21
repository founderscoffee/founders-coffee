import {
  ACCOUNT_ROWS,
  MARKET_FEATURE_FLAGS,
  MARKET_ROWS,
  eventRows,
} from './rows.mjs';
import { insertIgnore } from './sql.mjs';

/**
 * Every statement the seed runs, in an order the foreign keys allow.
 *
 * Markets come before the events that reference them and accounts before the events they host, so
 * the list is a dependency order rather than a narrative one. `member_profiles` and
 * `account_preferences` are seeded alongside each account because migration 0020 gave every
 * existing user one of each, and a seeded account without them is a shape the app has never seen.
 *
 * @param {number} now seconds since the epoch, as `unixepoch()` returns them.
 * @returns {string[]} SQL statements to run in order.
 */
export const seedStatements = (now) => {
  const { events, rsvps } = eventRows(now);
  const flags = JSON.stringify(MARKET_FEATURE_FLAGS);

  return [
    insertIgnore(
      'markets',
      MARKET_ROWS.map((market) => ({ ...market, feature_flags: flags })),
    ),
    insertIgnore('user', ACCOUNT_ROWS),
    insertIgnore(
      'member_profiles',
      ACCOUNT_ROWS.map((account) => ({ user_id: account.id })),
    ),
    insertIgnore(
      'account_preferences',
      ACCOUNT_ROWS.map((account) => ({ user_id: account.id })),
    ),
    insertIgnore('events', events),
    insertIgnore('event_rsvps', rsvps),
  ].filter((statement) => statement !== '');
};
