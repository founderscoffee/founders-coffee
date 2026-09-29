import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { appErrorCode } from '@founders-coffee/core';
import { localizedName, type Locale } from '@founders-coffee/i18n';
import {
  getMarketLanding,
  type MarketWithCities,
} from '@founders-coffee/server-fns';

import { CompanyPage } from '../components/company/CompanyPage';
import { MarketLanding } from '../components/landing/MarketLanding';
import {
  COMPANY_PAGES,
  companyPageContent,
  isCompanyPageKey,
  type CompanyPageEntry,
  type CompanyPageKey,
} from '../content/company';
import { DEFAULT_MARKET_SLUG } from '../features/markets/api';
import {
  cursorPairOnly,
  paginationQuery,
  publicPaginationSearchSchema,
  type PublicPaginationSearch,
} from '../lib/public-pagination';
import { localizedLanding } from '../lib/locale-routing';
import { canonicalUrl } from '../lib/seo';
import { companyPageHead } from '../lib/seo-company';
import { marketPageHead, type MarketReference } from '../lib/seo-market';

type LocalizedMarket = MarketWithCities & {
  readonly kind: 'market';
  readonly locale: Locale;
  readonly pagination: PublicPaginationSearch;
  readonly markets: readonly MarketReference[];
};

type LocalizedCompany = {
  readonly kind: 'company';
  readonly locale: Locale;
  readonly page: CompanyPageKey;
};

type RouteData = LocalizedMarket | LocalizedCompany;

const landingSearchSchema = publicPaginationSearchSchema;

const localizedMarket = async (
  locale: Locale,
  marketKey: string,
  pagination: PublicPaginationSearch,
  markets: readonly MarketReference[],
): Promise<LocalizedMarket> => {
  try {
    const data = await getMarketLanding({
      data: { key: marketKey, ...pagination },
    });
    if (marketKey !== data.market.slug) {
      throw redirect({
        ...localizedLanding(locale, data.market.slug),
        search: pagination,
      });
    }
    if (!data.cursorValid) {
      throw redirect({
        ...localizedLanding(locale, data.market.slug),
        search: {},
      });
    }
    return { kind: 'market', locale, pagination, ...data, markets };
  } catch (error) {
    if (appErrorCode(error) === 'market_not_found') throw notFound();
    throw error;
  }
};

const MarketRoute = () => {
  const data = Route.useLoaderData();
  if (data.kind === 'market') {
    return (
      <MarketLanding
        locale={data.locale}
        market={data.market}
        cities={data.cities}
        cityEventCounts={data.cityEventCounts}
        events={data.events}
        afterStartsAt={data.pagination.afterStartsAt}
        afterId={data.pagination.afterId}
        nextCursor={data.eventsNextCursor}
        trending={data.trending}
      />
    );
  }
  const entry: CompanyPageEntry = COMPANY_PAGES[data.page];
  return (
    <CompanyPage
      locale={data.locale}
      content={companyPageContent(data.page, data.locale)}
      related={entry.related}
      showEmailActions={entry.emailActions === true}
    />
  );
};

export const Route = createFileRoute('/$locale/$market/')({
  validateSearch: landingSearchSchema,
  loaderDeps: ({ search }) => ({
    afterStartsAt: search.afterStartsAt,
    afterId: search.afterId,
  }),
  component: MarketRoute,
  loader: async ({ params, deps, context }): Promise<RouteData> => {
    const pagination = cursorPairOnly(deps);
    if (isCompanyPageKey(params.market))
      return { kind: 'company', locale: context.locale, page: params.market };
    return localizedMarket(
      context.locale,
      params.market,
      pagination,
      context.markets.map(({ code, slug }) => ({ code, slug })),
    );
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [], links: [], scripts: [] };
    if (loaderData.kind === 'market') {
      return marketPageHead({
        locale: loaderData.locale,
        marketName: localizedName(loaderData.market, loaderData.locale),
        marketCode: loaderData.market.code,
        markets: loaderData.markets,
        defaultMarket: DEFAULT_MARKET_SLUG,
        events: loaderData.events.map((event) => ({
          name: event.title,
          url: canonicalUrl({
            type: 'event',
            market: loaderData.market.slug,
            slug: event.slug,
            locale: loaderData.locale,
          }),
        })),
        route: {
          type: 'market',
          market: loaderData.market.slug,
          locale: loaderData.locale,
          query: paginationQuery(loaderData.pagination),
        },
      });
    }
    const content = companyPageContent(loaderData.page, loaderData.locale);
    const entry: CompanyPageEntry = COMPANY_PAGES[loaderData.page];
    return companyPageHead({
      locale: loaderData.locale,
      path: `/${loaderData.page}`,
      canonicalLocale: loaderData.locale,
      title: content.title,
      description: content.description,
      faq: entry.faq === true ? content : undefined,
    });
  },
});
