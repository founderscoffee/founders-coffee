import {
  Outlet,
  createFileRoute,
  notFound,
  redirect,
  useChildMatches,
} from '@tanstack/react-router';

import { appErrorCode } from '@founders-coffee/core';
import {
  detectLocale,
  isLocale,
  localizedName,
  type Locale,
} from '@founders-coffee/i18n';
import {
  getCityLanding,
  getMarketLanding,
  type MarketCity,
  type MarketWithCities,
} from '@founders-coffee/server-fns';

import { CompanyPage } from '../components/company/CompanyPage';
import { CityLanding } from '../components/landing/CityLanding';
import { MarketLanding } from '../components/landing/MarketLanding';
import {
  COMPANY_PAGES,
  companyPageContent,
  isCompanyPageKey,
  type CompanyPageEntry,
  type CompanyPageKey,
} from '../content/company';
import { readCookieHeader } from '../lib/cookies';
import {
  paginationQuery,
  publicPaginationSearchSchema,
  type PublicPaginationSearch,
} from '../lib/public-pagination';
import { isMarketLeaf } from '../lib/route-market';
import {
  canonicalUrl,
  cityPageHead,
  getRequestPath,
  marketPageHead,
} from '../lib/seo';
import { companyPageHead } from '../lib/seo-company';

type LocalizedMarket = MarketWithCities & {
  readonly kind: 'market';
  readonly locale: Locale;
  readonly pagination: PublicPaginationSearch;
};

type LocalizedCity = MarketCity & {
  readonly kind: 'city';
  readonly locale: Locale;
  readonly pagination: PublicPaginationSearch;
};

type LocalizedCompany = {
  readonly kind: 'company';
  readonly locale: Locale;
  readonly page: CompanyPageKey;
};

type RouteData = LocalizedMarket | LocalizedCity | LocalizedCompany;

const landingSearchSchema = publicPaginationSearchSchema;

const localizedMarket = async (
  locale: Locale,
  marketKey: string,
  pagination: PublicPaginationSearch,
  isLeaf: boolean,
): Promise<LocalizedMarket> => {
  try {
    const data = await getMarketLanding({
      data: { key: marketKey, ...pagination },
    });
    if (marketKey !== data.market.slug) {
      throw redirect({
        to: '/$market/$city',
        params: { market: locale, city: data.market.slug },
        search: pagination,
      });
    }
    if (isLeaf && !data.cursorValid) {
      throw redirect({
        to: '/$market/$city',
        params: { market: locale, city: data.market.slug },
        search: {},
      });
    }
    return { kind: 'market', locale, pagination, ...data };
  } catch (error) {
    if (appErrorCode(error) === 'market_not_found') throw notFound();
    throw error;
  }
};

export const Route = createFileRoute('/$market/$city')({
  validateSearch: landingSearchSchema,
  loaderDeps: ({ search }) => ({
    afterStartsAt: search.afterStartsAt,
    afterId: search.afterId,
  }),
  component: () => {
    const childMatches = useChildMatches();
    const data = Route.useLoaderData();
    if (childMatches.length > 0) return <Outlet />;

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
    if (data.kind === 'company') {
      const entry: CompanyPageEntry = COMPANY_PAGES[data.page];
      const arabicSource = entry.kind === 'arabic';
      return (
        <CompanyPage
          locale={data.locale}
          content={companyPageContent(data.page, data.locale)}
          related={entry.related}
          showEmailActions={
            entry.kind === 'localized' && entry.emailActions === true
          }
          arabicSource={arabicSource}
        />
      );
    }
    return (
      <CityLanding
        locale={data.locale}
        market={data.market}
        city={data.city}
        events={data.events}
        nextCursor={data.eventsNextCursor}
      />
    );
  },
  loader: async ({ params, deps, location }): Promise<RouteData> => {
    if (isLocale(params.market)) {
      if (isCompanyPageKey(params.city)) {
        return { kind: 'company', locale: params.market, page: params.city };
      }
      return localizedMarket(
        params.market,
        params.city,
        deps,
        isMarketLeaf(location.pathname),
      );
    }

    try {
      const data = await getCityLanding({
        data: {
          marketKey: params.market,
          citySlug: params.city,
          ...deps,
        },
      });
      throw redirect({
        to: '/$market/$city/$subcity',
        params: {
          market: detectLocale(readCookieHeader()),
          city: data.market.slug,
          subcity: data.city.slug,
        },
        search: deps,
      });
    } catch (error) {
      const code = appErrorCode(error);
      if (code === 'market_not_found' || code === 'city_not_found')
        throw notFound();
      throw error;
    }
  },
  head: ({ loaderData }) => {
    const pathSegments = getRequestPath().split('/').filter(Boolean);
    if (pathSegments.length >= 3) {
      return { meta: [], links: [], scripts: [] };
    }
    if (!loaderData) return { meta: [], links: [], scripts: [] };
    if (loaderData.kind === 'market') {
      return marketPageHead({
        locale: loaderData.locale,
        marketName: localizedName(loaderData.market, loaderData.locale),
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
    if (loaderData.kind === 'company') {
      const content = companyPageContent(loaderData.page, loaderData.locale);
      const entry: CompanyPageEntry = COMPANY_PAGES[loaderData.page];
      return companyPageHead({
        locale: loaderData.locale,
        path: `/${loaderData.page}`,
        canonicalLocale: loaderData.locale,
        soleLocale: entry.kind === 'arabic' ? 'ar' : undefined,
        title: content.title,
        description: content.description,
        faq:
          entry.kind === 'localized' && entry.faq === true
            ? content
            : undefined,
      });
    }
    const cityName = localizedName(loaderData.city, loaderData.locale);
    return cityPageHead({
      locale: loaderData.locale,
      marketName: localizedName(loaderData.market, loaderData.locale),
      cityName,
      isEmpty: loaderData.events.length === 0,
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
        type: 'city',
        market: loaderData.market.slug,
        city: loaderData.city.slug,
        locale: loaderData.locale,
        query: paginationQuery(loaderData.pagination),
      },
    });
  },
});
