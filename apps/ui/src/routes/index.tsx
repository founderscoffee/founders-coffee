import { createFileRoute, redirect } from '@tanstack/react-router';

import { appErrorCode } from '@founders-coffee/core';
import { detectLocale, isLocale } from '@founders-coffee/i18n';
import { getGeoCountry, getMarketLanding } from '@founders-coffee/server-fns';

import { readCookieHeader, readCookies } from '../lib/cookies';

const DEFAULT_MARKET_SLUG = 'algeria';
const GEO_COOKIE = 'fc_geo';

const tryMarketSlug = async (key: string): Promise<string | null> => {
  try {
    const { market } = await getMarketLanding({ data: { key } });
    return market.slug;
  } catch (error) {
    if (appErrorCode(error) === 'market_not_found') return null;
    throw error;
  }
};

export const Route = createFileRoute('/')({
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  beforeLoad: async ({ params }) => {
    const routeParams = params as { readonly market?: string };
    const remembered = readCookies()[GEO_COOKIE];
    const country = remembered ?? (await getGeoCountry());
    const slug = country ? await tryMarketSlug(country) : null;
    const target = slug ?? DEFAULT_MARKET_SLUG;
    const locale = isLocale(routeParams.market)
      ? routeParams.market
      : detectLocale(readCookieHeader());
    throw redirect({
      to: '/$market/$city',
      params: { market: locale, city: target },
      headers: {
        'Set-Cookie': `${GEO_COOKIE}=${target}; Path=/; Max-Age=31536000; SameSite=Lax`,
      },
    });
  },
  component: () => null,
});
