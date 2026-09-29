import { describe, expect, it } from 'vitest';

import { LOCALES, type Locale } from '@founders-coffee/i18n';
import { runWithContext } from '@founders-coffee/observability/context';

import { marketPageHead, type MarketReference } from './seo-market';

const ORIGIN = 'https://founders.coffee';

const MARKETS: readonly MarketReference[] = [
  { code: 'DZ', slug: 'algeria' },
  { code: 'EG', slug: 'egypt' },
  { code: 'SA', slug: 'saudi-arabia' },
];

const landing = (
  market: MarketReference,
  locale: Locale,
  options: {
    readonly markets?: readonly MarketReference[];
    readonly query?: string;
  } = {},
) =>
  runWithContext({ siteOrigin: ORIGIN }, () =>
    marketPageHead({
      locale,
      marketName: market.slug,
      marketCode: market.code,
      markets: options.markets ?? MARKETS,
      defaultMarket: 'algeria',
      route: {
        type: 'market',
        market: market.slug,
        locale,
        query: options.query,
      },
    }),
  );

const alternates = (head: ReturnType<typeof landing>) =>
  head.links.flatMap((link) =>
    'hrefLang' in link ? [[link.hrefLang, link.href.replace(ORIGIN, '')]] : [],
  );

const [ALGERIA, EGYPT, SAUDI_ARABIA] = MARKETS as [
  MarketReference,
  MarketReference,
  MarketReference,
];

describe('market landing page metadata', () => {
  it('uses localized market copy and emits a complete shared metadata set', () => {
    const head = runWithContext({ siteOrigin: ORIGIN }, () =>
      marketPageHead({
        locale: 'en',
        marketName: 'Algeria',
        marketCode: 'DZ',
        markets: MARKETS,
        defaultMarket: 'algeria',
        events: [
          {
            name: 'Founders breakfast',
            url: 'https://founders.coffee/en/algeria/e/founders-breakfast',
          },
        ],
        route: { type: 'market', market: 'algeria', locale: 'en' },
      }),
    );

    expect(head.meta).toEqual(
      expect.arrayContaining([
        { title: 'Founders Coffee - Algeria' },
        {
          name: 'description',
          content: expect.stringContaining(
            'We gather entrepreneurs and founders in Algeria',
          ),
        },
        { property: 'og:url', content: 'https://founders.coffee/en/algeria' },
        { property: 'og:locale', content: 'en_DZ' },
        {
          property: 'og:image',
          content: 'https://founders.coffee/social/founders-coffee-default.png',
        },
        { property: 'og:image:width', content: '1200' },
        { property: 'og:image:height', content: '630' },
        {
          name: 'twitter:image',
          content: 'https://founders.coffee/social/founders-coffee-default.png',
        },
        { name: 'twitter:card', content: 'summary_large_image' },
      ]),
    );
    expect(head.links).toContainEqual({
      rel: 'canonical',
      href: 'https://founders.coffee/en/algeria',
    });
    expect(JSON.parse(head.scripts[0]?.children ?? '{}')).toMatchObject({
      '@type': 'CollectionPage',
      mainEntity: {
        itemListElement: [{ name: 'Founders breakfast', position: 1 }],
      },
    });
  });

  it('names every language of every market by its country, then a bare language for anywhere else', () => {
    expect(alternates(landing(EGYPT, 'ar'))).toEqual([
      ['ar-DZ', '/ar/algeria'],
      ['en-DZ', '/en/algeria'],
      ['fr-DZ', '/fr/algeria'],
      ['ar-EG', '/ar/egypt'],
      ['en-EG', '/en/egypt'],
      ['fr-EG', '/fr/egypt'],
      ['ar-SA', '/ar/saudi-arabia'],
      ['en-SA', '/en/saudi-arabia'],
      ['fr-SA', '/fr/saudi-arabia'],
      ['ar', '/ar/algeria'],
      ['en', '/en/algeria'],
      ['fr', '/fr/algeria'],
      ['x-default', '/ar/algeria'],
    ]);
  });

  it('gives all nine landing pages the same set, so each one points back at every other', () => {
    const sets = MARKETS.flatMap((market) =>
      LOCALES.map((locale) => alternates(landing(market, locale))),
    );

    expect(sets).toHaveLength(9);
    for (const set of sets)
      expect(
        set,
        'Google ignores an hreflang pair unless both pages name each other',
      ).toEqual(sets[0]);
  });

  it("says the landing is in its market's country, in og:locale as in hreflang", () => {
    expect(landing(SAUDI_ARABIA, 'fr').meta).toContainEqual({
      property: 'og:locale',
      content: 'fr_SA',
    });
    expect(landing(ALGERIA, 'ar').meta).toContainEqual({
      property: 'og:locale',
      content: 'ar_DZ',
    });
  });

  it("keeps a later page of meetups to its own market's languages", () => {
    const query = 'afterStartsAt=1725000000000&afterId=evt_1';

    expect(
      alternates(landing(EGYPT, 'fr', { query })),
      "a cursor walks one market's meetups, so no other market has this page",
    ).toEqual([
      ['ar', `/ar/egypt?${query}`],
      ['en', `/en/egypt?${query}`],
      ['fr', `/fr/egypt?${query}`],
      ['x-default', `/ar/egypt?${query}`],
    ]);
  });

  it('names only its own languages when its market is not among the visible ones', () => {
    expect(
      alternates(landing(EGYPT, 'ar', { markets: [ALGERIA, SAUDI_ARABIA] })),
    ).toEqual([
      ['ar', '/ar/egypt'],
      ['en', '/en/egypt'],
      ['fr', '/fr/egypt'],
      ['x-default', '/ar/egypt'],
    ]);
  });

  it('sends the bare languages to the first visible market when the default one is hidden', () => {
    const markets = [EGYPT, SAUDI_ARABIA];
    const set = alternates(landing(SAUDI_ARABIA, 'en', { markets }));

    expect(set.slice(-4)).toEqual([
      ['ar', '/ar/egypt'],
      ['en', '/en/egypt'],
      ['fr', '/fr/egypt'],
      ['x-default', '/ar/egypt'],
    ]);
    expect(
      alternates(landing(EGYPT, 'ar', { markets })),
      'every landing has to agree on the fallback, or the pairs stop matching',
    ).toEqual(set);
  });
});
