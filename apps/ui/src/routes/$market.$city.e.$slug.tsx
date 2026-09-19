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
import { canonicalUrl, getSiteOrigin } from '../lib/seo';
import { eventPageHead } from '../lib/seo-event';

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
    const cityName =
      loaderData.locale === 'ar'
        ? loaderData.event.cityNameAr
        : loaderData.event.cityName;
    const eventUrl = canonicalUrl({
      type: 'event',
      market: loaderData.market.slug,
      slug: loaderData.event.slug,
      locale: loaderData.locale,
    });
    const citySlug = loaderData.event.citySlug ?? loaderData.event.cityCode;
    const marketName =
      loaderData.locale === 'ar'
        ? (loaderData.market.nameAr ?? loaderData.market.name)
        : loaderData.market.name;
    return eventPageHead({
      locale: loaderData.locale,
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
        status: loaderData.event.status,
        venue: loaderData.event.venue,
        cityName,
        venueAddress: loaderData.event.venueAddress,
        latitude: loaderData.event.latitude,
        longitude: loaderData.event.longitude,
        marketCode: loaderData.event.marketCode,
        language: loaderData.event.language,
        url: eventUrl,
        currency: loaderData.market.defaultCurrency,
        organizer: loaderData.host
          ? {
              name: loaderData.host.displayName,
              url: `${getSiteOrigin()}/u/${encodeURIComponent(loaderData.host.userId)}`,
            }
          : null,
      },
      breadcrumbs: [
        {
          name: 'Founders Coffee',
          url: canonicalUrl({ type: 'root', locale: loaderData.locale }),
        },
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
