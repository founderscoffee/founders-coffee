import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { MARKET_FEATURE_FLAGS, MARKET_ROWS } from './rows.mjs';

const SEED = path.resolve(
  import.meta.dirname,
  '..',
  '..',
  'libs/db/src/seed.ts',
);

const COLUMN_TO_FIELD = {
  code: 'code',
  name: 'name',
  name_ar: 'nameAr',
  name_fr: 'nameFr',
  slug: 'slug',
  default_locale: 'defaultLocale',
  default_currency: 'defaultCurrency',
  timezone: 'timezone',
  direction: 'direction',
  state: 'state',
};

/**
 * `SEED_MARKETS` read as text rather than imported.
 *
 * `libs/db` is another Nx project and the boundary rule refuses a relative import into it, which is
 * right: a tool is not a consumer of the data layer. Reading the source is enough for the one thing
 * this needs to know — whether the rows the tool writes still match the rows the application
 * declares — and it fails loudly the moment they diverge, which is the only outcome that matters.
 *
 * @returns {string} the contents of libs/db/src/seed.ts.
 */
const seedSource = () => readFileSync(SEED, 'utf8');

describe('the markets the dev seed writes', () => {
  it('are the markets libs/db declares, value for value', () => {
    const source = seedSource();

    for (const row of MARKET_ROWS)
      for (const [column, field] of Object.entries(COLUMN_TO_FIELD))
        expect(
          source.includes(`${field}: '${row[column]}'`),
          `libs/db/src/seed.ts has no "${field}: '${row[column]}'". The dev seed repeats these rows because it runs under plain node and cannot import TypeScript, so this test is the only thing holding the copy to the original — change SEED_MARKETS and change tools/dev-seed/rows.mjs with it`,
        ).toBe(true);
  });

  it('are all of them, so a market added upstream cannot be missed', () => {
    const declared = seedSource().match(/^ {4}code: '[A-Z]{2}',$/gm) ?? [];

    expect(
      declared.length,
      `libs/db/src/seed.ts declares ${declared.length} markets and the dev seed writes ${MARKET_ROWS.length}. A market the application configures but the seed omits leaves a local database that cannot render it`,
    ).toBe(MARKET_ROWS.length);
  });

  it('carry the feature flags libs/db gives them', () => {
    const source = seedSource();

    for (const [flag, value] of Object.entries(MARKET_FEATURE_FLAGS))
      expect(
        source.includes(`${flag}: ${value}`),
        `libs/db/src/seed.ts has no "${flag}: ${value}". communityOperations in particular gates the closeout and feedback paths this seed exists to make reachable, so a local database seeded with it off would refuse them for a reason nothing explains`,
      ).toBe(true);
  });
});
