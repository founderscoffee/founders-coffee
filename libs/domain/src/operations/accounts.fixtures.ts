/**
 * Ids shaped the way Better Auth mints them, not the way `id()` mints entity ids.
 *
 * `defaultGenerateId` returns 32 characters of `a-zA-Z0-9` — no prefix, no underscore — and this
 * project does not set `advanced.database.generateId`, so that is what every account carries. The
 * four below are real ids taken from local accounts: a schema that refuses them refuses everybody.
 *
 * Tests reached for `id('usr')` before this existed, which produces `usr_` and thirty-two hex
 * digits. Nothing has that shape, so the suites agreed with a schema that no account could satisfy.
 */
export const accountIds = (): readonly string[] => [
  '5ptyLLdrxvQCTp9nrQ8zJSKORtEuKttA',
  'RK1NjFHaQV87s3kiMMXCQOsJWq8RrF46',
  'JeWCuMCarPeYWx3VQGs38608s27lBbl4',
  'pv0UMgJtYsPgoh7ywr7uucPOtAFesPV5',
];

/** One account id, for a suite that needs a member rather than a set of them. */
export const anAccountId = (which = 0): string =>
  accountIds()[which % accountIds().length];
