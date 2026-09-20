import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { appErrorCode } from '@founders-coffee/core';
import { isLocale, localizedName, type Locale } from '@founders-coffee/i18n';
import { getCityLanding, type MarketCity } from '@founders-coffee/server-fns';

import { CityLanding } from '../components/landing/CityLanding';
import { localizedCity } from '../lib/locale-routing';
import {
  cursorPairOnly,
  paginationQuery,
  publicPaginationSearchSchema,
  type PublicPaginationSearch,
} from '../lib/public-pagination';
import { canonicalUrl, cityPageHead } from '../lib/seo';

export const Route = createFileRoute('/$market/$city/$subcity')({
  validateSearch: publicPaginationSearchSchema,
  loaderDeps: ({ search }) => ({
    afterStartsAt: search.afterStartsAt,
    afterId: search.afterId,
  }),
  component: () => {
    const {
      locale,
      market,
      city,
      events,
      eventsNextCursor,
      afterStartsAt,
      afterId,
    } = Route.useLoaderData();
    return (
      <CityLanding
        locale={locale}
        market={market}
        city={city}
        events={events}
        afterStartsAt={afterStartsAt}
        afterId={afterId}
        nextCursor={eventsNextCursor}
      />
    );
  },
  loader: async ({
    params,
    deps,
  }): Promise<
    MarketCity & {
      locale: Locale;
      pagination: PublicPaginationSearch;
      afterStartsAt?: number;
      afterId?: string;
    }
  > => {
    if (!isLocale(params.market)) throw notFound();
    const pagination = cursorPairOnly(deps);
    try {
      const data = await getCityLanding({
        data: {
          marketKey: params.city,
          citySlug: params.subcity,
          ...pagination,
        },
      });
      if (params.city !== data.market.slug) {
        throw redirect({
          ...localizedCity(params.market, data.market.slug, data.city.slug),
          search: pagination,
        });
      }
      if (!data.cursorValid) {
        throw redirect({
          ...localizedCity(params.market, data.market.slug, data.city.slug),
          search: {},
        });
      }
      return {
        ...data,
        ...pagination,
        locale: params.market,
        pagination,
      };
    } catch (error) {
      const code = appErrorCode(error);
      if (code === 'market_not_found' || code === 'city_not_found')
        throw notFound();
      throw error;
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [], links: [], scripts: [] };
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
