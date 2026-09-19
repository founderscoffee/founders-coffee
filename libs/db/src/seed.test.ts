import { count } from 'drizzle-orm';
import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createDb } from './db.js';
import { markets } from './schema.js';
import { SEED_MARKETS, seed } from './seed.js';

describe('libs/db seed (real D1 via Miniflare)', () => {
  const db = createDb(env.DB);

  it('seeds the three launch markets with launch config', async () => {
    await seed(db);

    const rows = await db.select().from(markets).all();
    expect(rows.map((m) => m.code).sort()).toEqual(['DZ', 'EG', 'SA']);

    const dz = rows.find((m) => m.code === 'DZ');
    expect(dz?.state).toBe('active');
    expect(dz?.defaultCurrency).toBe('DZD');
    expect(dz?.defaultLocale).toBe('ar');
    expect(dz?.direction).toBe('rtl');
    expect(dz?.featureFlags).toEqual({
      events: true,
      hackathons: false,
      payments: false,
      recruiting: false,
      communityOperations: true,
    });

    const eg = rows.find((m) => m.code === 'EG');
    expect(eg?.state).toBe('active');
    expect(eg?.defaultCurrency).toBe('EGP');
    expect(eg?.featureFlags?.communityOperations).toBe(true);

    const sa = rows.find((m) => m.code === 'SA');
    expect(sa?.state).toBe('active');
    expect(sa?.defaultCurrency).toBe('SAR');
    expect(sa?.featureFlags?.communityOperations).toBe(true);
  });

  it('names every market in French, in a shape the French copy can take a preposition in front of', () => {
    expect(SEED_MARKETS.map((m) => m.code).sort()).toEqual(['DZ', 'EG', 'SA']);

    for (const market of SEED_MARKETS) {
      expect(market.nameFr, `${market.code} has no French name`).toBeTruthy();
      expect(
        market.nameFr,
        `${market.code}: fr.json writes "dans les villes d’{market}" and "en {market}". Both only read as French in front of a feminine, vowel-initial, singular country name. "Maroc" needs "du Maroc" and "au Maroc"; "Tunisie" needs "de Tunisie"; "Émirats arabes unis" needs "des Émirats" and "aux Émirats". Whichever it is, rewrite market_hero_desc, cities_in, footer_tagline and back_to_market before adding the market — this check only catches the consonant case`,
      ).toMatch(
        /^[AEIOU\u00C0\u00C2\u00C9\u00C8\u00CA\u00CE\u00D4\u00D9\u00DB]/u,
      );
    }
  });

  it('keeps the longest Arabic market name the one the discover heading was measured against', () => {
    const longest = [...SEED_MARKETS]
      .map((market) => market.nameAr ?? '')
      .sort((a, b) => b.length - a.length)[0];

    expect(
      longest,
      'the phone discover heading holds one line by dividing the available width by 19.8, which is the Arabic string measured with \u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629 in it. A longer market name makes that heading wrap again, so re-measure it in libs/ui/src/styles.css before adding one',
    ).toBe('\u0627\u0644\u0633\u0639\u0648\u062f\u064a\u0629');
  });

  it('is idempotent — re-running neither duplicates nor overwrites', async () => {
    await seed(db);
    await seed(db);

    const [{ marketTotal }] = await db
      .select({ marketTotal: count() })
      .from(markets);
    expect(marketTotal).toBe(SEED_MARKETS.length);
  });
});
