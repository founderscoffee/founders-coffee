import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale, isLocale } from '@founders-coffee/i18n';

import { geoMarketSlug } from '../features/markets/api';
import { readCookieHeader, readCookies } from '../lib/cookies';

const DEFAULT_MARKET_SLUG = 'algeria';
const GEO_COOKIE = 'fc_geo';

export const Route = createFileRoute('/')({
  preload: false,
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  beforeLoad: async ({ params }) => {
    const routeParams = params as { readonly market?: string };
    const target =
      (await geoMarketSlug(readCookies()[GEO_COOKIE])) ?? DEFAULT_MARKET_SLUG;
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
