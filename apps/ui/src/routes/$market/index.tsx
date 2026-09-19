import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { appErrorCode } from '@founders-coffee/core';
import type { Market } from '@founders-coffee/db';
import { detectLocale, isLocale } from '@founders-coffee/i18n';
import { getMarket } from '@founders-coffee/server-fns';

import { readCookieHeader } from '../../lib/cookies';

export const Route = createFileRoute('/$market/')({
  component: () => null,
  loader: async ({ params }) => {
    if (isLocale(params.market)) {
      throw redirect({
        to: '/$market/$city',
        params: { market: params.market, city: 'algeria' },
      });
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
    throw redirect({
      to: '/$market/$city',
      params: {
        market: detectLocale(readCookieHeader()),
        city: market.slug,
      },
    });
  },
  head: () => ({ meta: [], links: [], scripts: [] }),
});
