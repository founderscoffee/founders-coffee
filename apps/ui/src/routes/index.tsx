import { createFileRoute, redirect } from '@tanstack/react-router';

import { detectLocale, isLocale } from '@founders-coffee/i18n';

import { GEO_COOKIE, landingMarketSlug } from '../features/markets/api';
import { readCookieHeader, readCookies } from '../lib/cookies';
import { localizedLanding } from '../lib/locale-routing';

export const Route = createFileRoute('/')({
  beforeLoad: async ({ params, context }) => {
    const routeParams = params as { readonly market?: string };
    const target = await landingMarketSlug(
      context.markets,
      readCookies()[GEO_COOKIE],
    );
    const locale = isLocale(routeParams.market)
      ? routeParams.market
      : detectLocale(readCookieHeader());
    throw redirect({
      ...localizedLanding(locale, target),
      headers: {
        'Set-Cookie': `${GEO_COOKIE}=${target}; Path=/; Max-Age=31536000; SameSite=Lax`,
      },
    });
  },
  component: () => null,
});
