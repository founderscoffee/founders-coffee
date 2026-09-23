import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { appErrorCode, prefixedId } from '@founders-coffee/core';
import { getEvent, getMarket } from '@founders-coffee/server-fns';

import { localizedEvent } from '../lib/locale-routing';

export const Route = createFileRoute('/$locale/e/$slug')({
  preload: false,
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  component: () => null,
  loader: async ({ params, context }): Promise<never> => {
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
    throw redirect(localizedEvent(context.locale, market.slug, event.slug));
  },
  head: () => ({ meta: [], links: [] }),
});
