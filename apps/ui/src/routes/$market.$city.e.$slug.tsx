import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { appErrorCode } from '@founders-coffee/core';
import { isLocale, type Locale } from '@founders-coffee/i18n';
import {
  getEvent,
  getMarket,
  getPublicProfile,
  type EventDetailItem,
  type PublicProfile,
} from '@founders-coffee/server-fns';
import type { Market } from '@founders-coffee/db';

import { EventDetail } from '../components/events/EventDetail';
import { LiveDashboard } from '../features/events/components/LiveDashboard';
import { isLiveWindowOpen } from '../features/events/live-window';
import { useEventLive } from '../features/events/useEventLive';
import { useAuth } from '../lib/app-providers';
import { eventPageHead } from '../lib/seo';

type EventRouteData = {
  readonly locale: Locale;
  readonly market: Market;
  readonly event: EventDetailItem;
  readonly host: PublicProfile | null;
};

export const Route = createFileRoute('/$market/$city/e/$slug')({
  component: () => {
    const { locale, market, event, host } = Route.useLoaderData();
    const { user } = useAuth();
    const isHost = user?.id === event.hostId;
    const isWindowOpen =
      event.status !== 'cancelled' &&
      isLiveWindowOpen(event.startsAt, event.endsAt);
    const live = useEventLive(event.id, {
      enabled: Boolean(user) && isWindowOpen,
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
        {user && isWindowOpen && (
          <LiveDashboard
            live={live}
            currentUserId={user.id}
            isHost={isHost}
            locale={locale}
          />
        )}
      </>
    );
  },
  loader: async ({ params }): Promise<EventRouteData> => {
    if (!isLocale(params.market)) throw notFound();
    let market: Market;
    try {
      market = await getMarket({ data: { slug: params.city } });
    } catch (error) {
      if (appErrorCode(error) !== 'market_not_found') throw error;
      try {
        market = await getMarket({ data: { code: params.city } });
      } catch (byCode) {
        if (appErrorCode(byCode) === 'market_not_found') throw notFound();
        throw byCode;
      }
    }
    if (params.city !== market.slug) {
      throw redirect({
        to: '/$market/$city/e/$slug',
        params: {
          market: params.market,
          city: market.slug,
          slug: params.slug,
        },
      });
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

    const host = await getPublicProfile({
      data: { userId: event.hostId },
    }).catch((error: unknown) => {
      if (appErrorCode(error) === 'not_found') return null;
      throw error;
    });
    return { locale: params.market, market, event, host };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [], links: [] };
    const description = loaderData.event.description
      ? loaderData.event.description.length > 160
        ? `${loaderData.event.description.slice(0, 157)}...`
        : loaderData.event.description
      : '';
    return eventPageHead({
      title: loaderData.event.title,
      description,
      route: {
        type: 'event',
        market: loaderData.market.slug,
        slug: loaderData.event.slug,
        locale: loaderData.locale,
      },
    });
  },
});
