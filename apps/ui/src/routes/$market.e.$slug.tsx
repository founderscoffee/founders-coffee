import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { appErrorCode } from '@founders-coffee/core';
import { detectLocale } from '@founders-coffee/i18n';
import {
  getEvent,
  getMarket,
  type EventDetailItem,
} from '@founders-coffee/server-fns';
import type { Market } from '@founders-coffee/db';
import type { PublicProfile } from '@founders-coffee/server-fns';

import { EventDetail } from '../components/events/EventDetail';
import { LiveDashboard } from '../features/events/components/LiveDashboard';
import { isLiveWindowOpen } from '../features/events/live-window';
import { useEventLive } from '../features/events/useEventLive';
import { useAuth } from '../lib/app-providers';
import { localizedEvent } from '../lib/locale-routing';
import { readCookieHeader } from '../lib/cookies';

type EventDetailLoaderData = {
  market: Market;
  event: EventDetailItem;
  host: PublicProfile | null;
};

export const Route = createFileRoute('/$market/e/$slug')({
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
  component: () => {
    const { locale } = Route.useRouteContext();
    const { market, event, host } = Route.useLoaderData();
    const { user } = useAuth();
    const isHost = user?.id === event.hostId;
    const isWindowOpen =
      event.status !== 'cancelled' &&
      isLiveWindowOpen(event.startsAt, event.endsAt);
    const isAttending = isHost || event.viewerRsvp === 'going';
    const live = useEventLive(event.id, {
      enabled: Boolean(user) && isWindowOpen && isAttending,
    });

    return (
      <>
        <EventDetail
          locale={locale}
          market={market}
          event={event}
          host={host}
          isHost={isHost}
          live={user ? live : null}
          isWindowOpen={isWindowOpen}
        />
        {user && isWindowOpen && isAttending && !live.notAttending && (
          <LiveDashboard live={live} currentUserId={user.id} locale={locale} />
        )}
      </>
    );
  },
  loader: async ({ params }): Promise<EventDetailLoaderData> => {
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

    let event: EventDetailItem;
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
