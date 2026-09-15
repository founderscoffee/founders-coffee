import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { atMigration } from './migrations.fixtures.js';

describe('0029 — active launch markets', () => {
  it('activates DZ/EG/SA and removes legacy MA/AE rows', async () => {
    const { apply } = await atMigration('0029_activate_launch_markets.sql');

    await env.PRIOR_DB.batch([
      env.PRIOR_DB.prepare(
        "UPDATE markets SET state = 'open' WHERE code IN ('EG', 'SA')",
      ),
      env.PRIOR_DB.prepare(
        `INSERT INTO markets
          (code, name, name_ar, slug, default_locale, default_currency, timezone,
           direction, state, feature_flags)
         VALUES
          ('MA', 'Legacy Morocco', 'المغرب', 'legacy-morocco', 'ar', 'MAD',
           'Africa/Casablanca', 'rtl', 'dark', '{}'),
          ('AE', 'Legacy Emirates', 'الإمارات', 'legacy-emirates', 'ar', 'AED',
           'Asia/Dubai', 'rtl', 'dark', '{}')`,
      ),
    ]);

    await apply();

    const rows = await env.PRIOR_DB.prepare(
      'SELECT code, state FROM markets ORDER BY code',
    ).all<{ code: string; state: string }>();

    expect(rows.results).toEqual([
      { code: 'DZ', state: 'active' },
      { code: 'EG', state: 'active' },
      { code: 'SA', state: 'active' },
    ]);
  });
});
