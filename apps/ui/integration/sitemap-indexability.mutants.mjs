export default {
  command:
    'npx vitest run --config vitest.integration.config.ts integration/sitemap-indexability.integration.test.ts',
  cwd: 'apps/ui',
  mutants: [
    {
      name: 'the geo walk restored, which is #82 itself',
      expect: 'fail',
      edits: [
        {
          file: '../../libs/server-fns/src/sitemap.ts',
          find: '      cities: citiesWithSomethingToShow(cityRows, marketByCode),',
          replace:
            '      cities: visibleMarkets.flatMap((market) =>\n        geo\n          .getStates(market.code)\n          .flatMap((state) => geo.getCities(market.code, state.code))\n          .map((city) => ({ market: market.slug, city: city.slug })),\n      ),',
        },
      ],
    },
    {
      name: 'cities dropped from the sitemap entirely, which is not the fix either',
      expect: 'fail',
      edits: [
        {
          file: '../../libs/server-fns/src/sitemap.ts',
          find: '      cities: citiesWithSomethingToShow(cityRows, marketByCode),',
          replace: '      cities: [],',
        },
      ],
    },
    {
      name: 'the city page stops refusing indexing, which would make the exclusion wrong',
      expect: 'fail',
      edits: [
        {
          file: 'src/lib/seo.ts',
          find: "    robots: isEmpty ? 'noindex,follow' : 'index,follow',",
          replace: "    robots: 'index,follow',",
        },
      ],
    },
    {
      name: 'the sitemap built from every published event, so finished ones keep their city',
      expect: 'fail',
      edits: [
        {
          file: '../../libs/server-fns/src/sitemap.ts',
          find: '      cities: citiesWithSomethingToShow(cityRows, marketByCode),',
          replace:
            '      cities: citiesWithSomethingToShow(eventRows, marketByCode),',
        },
      ],
    },
    {
      name: 'the market list ordering changed, which no city assertion reads',
      expect: 'pass',
      edits: [
        {
          file: '../../libs/server-fns/src/sitemap.ts',
          find: '      markets: visibleMarkets.map(({ slug }) => ({ slug })),',
          replace:
            '      markets: [...visibleMarkets].reverse().map(({ slug }) => ({ slug })),',
        },
      ],
    },
  ],
};
