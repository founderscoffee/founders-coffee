import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { appErrorCode, prefixedId } from '@founders-coffee/core';
import { detectLocale, isLocale } from '@founders-coffee/i18n';
import { getEvent, getMarket } from '@founders-coffee/server-fns';
import type { Market } from '@founders-coffee/db';

import { localizedEvent } from '../lib/locale-routing';
import { readCookieHeader } from '../lib/cookies';

export const Route = createFileRoute('/$market/e/$slug')({
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  component: () => null,
  loader: async ({ params }): Promise<never> => {
    if (isLocale(params.market)) {
      let event;
      try {
        event = await getEvent({
          data: { id: prefixedId('evt', params.slug) },
        });
      } catch (error) {
        if (appErrorCode(error) === 'event_not_found') throw notFound();
        throw error;
      }
      const market = await getMarket({ data: { code: event.marketCode } });
      throw redirect(localizedEvent(params.market, market.slug, event.slug));
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
    const locale = detectLocale(readCookieHeader());
    if (params.market !== market.slug) {
      throw redirect(localizedEvent(locale, market.slug, params.slug));
    }

    let event;
    try {
      event = await getEvent({
        data: { marketCode: market.code, slug: params.slug },
      });
    } catch (error) {
      if (appErrorCode(error) === 'event_not_found') throw notFound();
      throw error;
    }

    throw redirect(localizedEvent(locale, market.slug, event.slug));
  },
  head: () => ({ meta: [], links: [] }),
});
