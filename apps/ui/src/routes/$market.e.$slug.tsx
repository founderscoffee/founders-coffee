import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { appErrorCode } from '@founders-coffee/core';
import {
  getEvent,
  getMarket,
  getPublicProfile,
  type EventWithAttendance,
} from '@founders-coffee/server-fns';
import type { Market } from '@founders-coffee/db';
import type { PublicProfile } from '@founders-coffee/server-fns';

import { EventDetail } from '../components/EventDetail';
import { LiveDashboard } from '../features/events/components/LiveDashboard';
import { useAuth } from '../lib/app-providers';

type EventDetailLoaderData = {
  market: Market;
  event: EventWithAttendance;
  host: PublicProfile;
};

export const Route = createFileRoute('/$market/e/$slug')({
  component: () => {
    const { locale } = Route.useRouteContext();
    const { market, event, host } = Route.useLoaderData();
    const { user } = useAuth();
    return (
      <>
        <EventDetail locale={locale} market={market} event={event} host={host} />
        {user && (
          <LiveDashboard
            eventId={event.id}
            currentUserId={user.id}
            isHost={user.id === event.hostId}
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
      throw redirect({ to: '/$market/e/$slug', params: { market: market.slug, slug: params.slug } });
    }

    let event: EventWithAttendance;
    try {
      event = await getEvent({ data: { marketCode: market.code, slug: params.slug } });
    } catch (error) {
      if (appErrorCode(error) === 'event_not_found') throw notFound();
      throw error;
    }

    const host = await getPublicProfile({ data: { userId: event.hostId } });
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
        { title: `${loaderData?.event.title ?? 'founders.coffee'} — founders.coffee` },
        { name: 'description', content: description },
        { property: 'og:title', content: loaderData?.event.title ?? 'founders.coffee' },
        { property: 'og:description', content: description },
        { property: 'og:type', content: 'event' },
      ],
    };
  },
});
