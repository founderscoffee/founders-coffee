import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { appErrorCode } from '@founders-coffee/core';
import type { Market } from '@founders-coffee/db';
import { detectLocale, isLocale } from '@founders-coffee/i18n';
import { getMarket } from '@founders-coffee/server-fns';

import { readCookieHeader } from '../../lib/cookies';
import { localizedLanding } from '../../lib/locale-routing';

export const Route = createFileRoute('/$market/')({
  component: () => null,
  loader: async ({ params }) => {
    if (isLocale(params.market)) {
      throw redirect(localizedLanding(params.market, 'algeria'));
    }
    let market: Market;
    try {
      market = await getMarket({ data: { slug: params.market } });
    } catch (error) {
      if (appErrorCode(error) !== 'market_not_found') throw error;
      try {
        market = await getMarket({ data: { code: params.market } });
      } catch (byCode) {
        if (appErrorCode(byCode) === 'market_not_found') throw notFound();
        throw byCode;
      }
    }
    throw redirect(
      localizedLanding(detectLocale(readCookieHeader()), market.slug),
    );
  },
  head: () => ({ meta: [], links: [], scripts: [] }),
});
