import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { appErrorCode } from '@founders-coffee/core';
import {
  getEvent,
  getMarket,
  getPublicProfile,
  type EventDetailItem,
} from '@founders-coffee/server-fns';
import type { Market } from '@founders-coffee/db';
import type { PublicProfile } from '@founders-coffee/server-fns';

import { EventDetail } from '../components/events/EventDetail';
import { LiveDashboard } from '../features/events/components/LiveDashboard';
import { isLiveWindowOpen } from '../features/events/live-window';
import { useEventLive } from '../features/events/useEventLive';
import { useAuth } from '../lib/app-providers';

type EventDetailLoaderData = {
  market: Market;
  event: EventDetailItem;
  host: PublicProfile | null;
};

export const Route = createFileRoute('/$market/e/$slug')({
  component: () => {
    const { locale } = Route.useRouteContext();
    const { market, event, host } = Route.useLoaderData();
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
  loader: async ({ params }): Promise<EventDetailLoaderData> => {
    let market: Market;
    try {
      market = await getMarket({ data: { slug: params.market } });
    } catch (error) {
      if (appErrorCode(error) === 'market_not_found') throw notFound();
      throw error;
    }
    if (params.market !== market.slug) {
      throw redirect({
        to: '/$market/e/$slug',
        params: { market: market.slug, slug: params.slug },
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
    return { market, event, host };
  },
  head: ({ loaderData }) => {
    const description = loaderData?.event.description
      ? loaderData.event.description.length > 160
        ? `${loaderData.event.description.slice(0, 157)}...`
        : loaderData.event.description
      : '';
    return {
      meta: [
        {
          title: `${loaderData?.event.title ?? 'founders.coffee'} - founders.coffee`,
        },
        { name: 'description', content: description },
        {
          property: 'og:title',
          content: loaderData?.event.title ?? 'founders.coffee',
        },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'event' },
      ],
    };
  },
});
