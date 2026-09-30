import { createFileRoute, notFound, redirect } from '@tanstack/react-router';
import { z } from 'zod';

import { appErrorCode, eventLanguages } from '@founders-coffee/core';
import { localizedName, type Locale } from '@founders-coffee/i18n';
import { getEventPage, type EventPage } from '@founders-coffee/server-fns';

import { EventDetail } from '../components/events/EventDetail';
import { LiveDashboard } from '../features/events/components/LiveDashboard';
import { eventCityName } from '../features/events/event-city-name';
import { eventRegionName } from '../features/events/event-region-name';
import { eventStreetAddress } from '../features/events/event-street-address';
import { eventPhase, isLiveWindowOpen } from '../features/events/live-window';
import { useEventLive } from '../features/events/useEventLive';
import { useAuth } from '../lib/app-providers';
import { localizedEvent } from '../lib/locale-routing';
import { canonicalUrl, getSiteOrigin } from '../lib/seo';
import { eventPageHead } from '../lib/seo-event';

type EventRouteData = EventPage & { readonly locale: Locale };

const EventRoute = () => {
  const { locale, market, event, host } = Route.useLoaderData();
  const { user } = useAuth();
  const isHost = user?.id === event.hostId;
  const isWindowOpen =
    event.status !== 'cancelled' &&
    isLiveWindowOpen(event.startsAt, event.endsAt);
  const phase = eventPhase(event.startsAt, event.endsAt);
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
        phase={phase}
      />
      {user && isWindowOpen && isAttending && !live.notAttending && (
        <LiveDashboard live={live} currentUserId={user.id} locale={locale} />
      )}
    </>
  );
};

export const Route = createFileRoute('/$locale/$market/e/$slug')({
  validateSearch: z.object({
    chat: z.literal(true).optional().catch(undefined),
  }),
  component: EventRoute,
  loader: async ({ params, context }): Promise<EventRouteData> => {
    const market = context.markets.find(
      (listed) => listed.slug === params.market,
    );
    if (!market) {
      const byCode = context.markets.find(
        (listed) => listed.code === params.market.toUpperCase(),
      );
      if (!byCode) throw notFound();
      throw redirect(localizedEvent(context.locale, byCode.slug, params.slug));
    }
    try {
      const page = await getEventPage({
        data: { marketCode: market.code, slug: params.slug },
      });
      return { locale: context.locale, ...page };
    } catch (error) {
      const code = appErrorCode(error);
      if (
        code === 'event_not_found' ||
        code === 'market_not_found' ||
        code === 'validation_failed'
      )
        throw notFound();
      throw error;
    }
  },
  head: ({ loaderData }) => {
    if (!loaderData) return { meta: [], links: [] };
    const cityName = eventCityName(loaderData.event, loaderData.locale);
    const eventUrl = canonicalUrl({
      type: 'event',
      market: loaderData.market.slug,
      slug: loaderData.event.slug,
      locale: loaderData.locale,
    });
    const citySlug = loaderData.event.citySlug ?? loaderData.event.cityCode;
    const marketName = localizedName(loaderData.market, loaderData.locale);
    return eventPageHead({
      locale: loaderData.locale,
      marketCode: loaderData.market.code,
      eventId: loaderData.event.id,
      version: loaderData.event.version,
      title: loaderData.event.title,
      cityName,
      description: loaderData.event.description,
      route: {
        type: 'event',
        market: loaderData.market.slug,
        slug: loaderData.event.slug,
        locale: loaderData.locale,
      },
      structuredEvent: {
        title: loaderData.event.title,
        description: loaderData.event.description,
        startsAt: loaderData.event.startsAt,
        endsAt: loaderData.event.endsAt,
        createdAt: loaderData.event.createdAt,
        timezone: loaderData.market.timezone,
        status: loaderData.event.status,
        venue: loaderData.event.venue,
        cityName,
        regionName: eventRegionName(loaderData.event, loaderData.locale),
        venueAddress: eventStreetAddress(loaderData.event),
        latitude: loaderData.event.latitude,
        longitude: loaderData.event.longitude,
        marketCode: loaderData.event.marketCode,
        languages: eventLanguages(loaderData.event),
        url: eventUrl,
        currency: loaderData.market.defaultCurrency,
        organizer: loaderData.host
          ? {
              name: loaderData.host.displayName,
              url: `${getSiteOrigin()}/${loaderData.locale}/u/${encodeURIComponent(loaderData.host.userId)}`,
            }
          : null,
      },
      breadcrumbs: [
        {
          name: marketName,
          url: canonicalUrl({
            type: 'market',
            market: loaderData.market.slug,
            locale: loaderData.locale,
          }),
        },
        {
          name: cityName,
          url: canonicalUrl({
            type: 'city',
            market: loaderData.market.slug,
            city: citySlug,
            locale: loaderData.locale,
          }),
        },
        { name: loaderData.event.title, url: eventUrl },
      ],
    });
  },
});
