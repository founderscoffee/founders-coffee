import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { appErrorCode } from '@founders-coffee/core';
import { isLocale, type Locale } from '@founders-coffee/i18n';
import { getCityLanding, type MarketCity } from '@founders-coffee/server-fns';

import { CityLanding } from '../components/landing/CityLanding';
import { canonicalUrl, cityPageHead } from '../lib/seo';

export const Route = createFileRoute('/$market/$city/$subcity')({
  staticData: { prerender: true },
  component: () => {
    const { locale, market, city, events } = Route.useLoaderData();
    return (
      <CityLanding
        locale={locale}
        market={market}
        city={city}
        events={events}
      />
    );
  },
  loader: async ({ params }): Promise<MarketCity & { locale: Locale }> => {
    if (!isLocale(params.market)) throw notFound();
    try {
      const data = await getCityLanding({
        data: { marketKey: params.city, citySlug: params.subcity },
      });
      if (params.city !== data.market.slug) {
        throw redirect({
          to: '/$market/$city/$subcity',
          params: {
            market: params.market,
            city: data.market.slug,
            subcity: data.city.slug,
          },
        });
      }
      return { ...data, locale: params.market };
    } catch (error) {
      const code = appErrorCode(error);
      if (code === 'market_not_found' || code === 'city_not_found')
        throw notFound();
      throw error;
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [], links: [], scripts: [] };
    const cityName =
      loaderData.locale === 'ar'
        ? (loaderData.city.nameAr ?? loaderData.city.name)
        : loaderData.city.name;
    return cityPageHead({
      locale: loaderData.locale,
      marketName:
        loaderData.locale === 'ar'
          ? (loaderData.market.nameAr ?? loaderData.market.name)
          : loaderData.market.name,
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
      },
    });
  },
});
