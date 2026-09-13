import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { appErrorCode } from '@founders-coffee/core';
import { detectLocale, isLocale, type Locale } from '@founders-coffee/i18n';
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
  aboutContent,
  contactContent,
  cookiesContent,
  privacyContent,
  termsContent,
} from '../content/company';
import { readCookieHeader } from '../lib/cookies';
import {
  canonicalUrl,
  cityPageHead,
  getRequestPath,
  marketPageHead,
} from '../lib/seo';
import { companyPageHead } from '../lib/seo-company';

const companyPages = {
  about: aboutContent,
  contact: contactContent,
  cookies: cookiesContent,
  privacy: privacyContent,
  terms: termsContent,
} as const;

type CompanyPageKey = keyof typeof companyPages;

type LocalizedMarket = MarketWithCities & {
  readonly kind: 'market';
  readonly locale: Locale;
};

type LocalizedCity = MarketCity & {
  readonly kind: 'city';
  readonly locale: Locale;
};

type LocalizedCompany = {
  readonly kind: 'company';
  readonly locale: Locale;
  readonly page: CompanyPageKey;
};

type RouteData = LocalizedMarket | LocalizedCity | LocalizedCompany;

const isCompanyPage = (value: string): value is CompanyPageKey =>
  value in companyPages;

const localizedMarket = async (
  locale: Locale,
  marketKey: string,
): Promise<LocalizedMarket> => {
  try {
    const data = await getMarketLanding({ data: { key: marketKey } });
    if (marketKey !== data.market.slug) {
      throw redirect({
        to: '/$market/$city',
        params: { market: locale, city: data.market.slug },
      });
    }
    return { kind: 'market', locale, ...data };
  } catch (error) {
    if (appErrorCode(error) === 'market_not_found') throw notFound();
    throw error;
  }
};

export const Route = createFileRoute('/$market/$city')({
  staticData: { prerender: true },
  component: () => {
    const data = Route.useLoaderData();
    if (data.kind === 'market') {
      return (
        <MarketLanding
          locale={data.locale}
          market={data.market}
          cities={data.cities}
          cityEventCounts={data.cityEventCounts}
          events={data.events}
          trending={data.trending}
        />
      );
    }
    if (data.kind === 'company') {
      return (
        <CompanyPage
          locale={data.locale}
          content={companyPages[data.page][data.locale]}
          showEmailActions={data.page === 'contact'}
        />
      );
    }
    return (
      <CityLanding
        locale={data.locale}
        market={data.market}
        city={data.city}
        events={data.events}
      />
    );
  },
  loader: async ({ params }): Promise<RouteData> => {
    if (isLocale(params.market)) {
      if (isCompanyPage(params.city)) {
        return { kind: 'company', locale: params.market, page: params.city };
      }
      return localizedMarket(params.market, params.city);
    }

    try {
      const data = await getCityLanding({
        data: { marketKey: params.market, citySlug: params.city },
      });
      throw redirect({
        to: '/$market/$city/$subcity',
        params: {
          market: detectLocale(readCookieHeader()),
          city: data.market.slug,
          subcity: data.city.slug,
        },
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
        marketName:
          loaderData.locale === 'ar'
            ? (loaderData.market.nameAr ?? loaderData.market.name)
            : loaderData.market.name,
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
        },
      });
    }
    if (loaderData.kind === 'company') {
      const content = companyPages[loaderData.page][loaderData.locale];
      return companyPageHead({
        locale: loaderData.locale,
        path: `/${loaderData.page}`,
        canonicalLocale: loaderData.locale,
        title: content.title,
        description: content.description,
      });
    }
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
