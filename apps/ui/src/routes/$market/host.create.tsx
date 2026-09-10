import { createFileRoute, notFound, redirect } from '@tanstack/react-router';
import { z } from 'zod';

import { appErrorCode } from '@founders-coffee/core';
import { getPublicAuthConfig } from '@founders-coffee/server-fns';
import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';

import { HostCreatePage } from '../../components/host/HostCreatePage';
import { eventsApi } from '../../features/events/api';

type HostCreateLoaderData = {
  market: Market;
  city: geo.GeoCity | null;
  mapboxToken: string;
  turnstileSiteKey: string | null;
  hasSocial: boolean;
};

export const Route = createFileRoute('/$market/host/create')({
  validateSearch: z.object({
    city: z.coerce.string().optional(),
    state: z.coerce.string().optional(),
  }),
  loaderDeps: ({ search }) => ({ city: search.city }),
  component: () => {
    const { locale } = Route.useRouteContext();
    const { market, city, mapboxToken, turnstileSiteKey, hasSocial } =
      Route.useLoaderData();
    return (
      <HostCreatePage
        locale={locale}
        market={market}
        city={city}
        mapboxToken={mapboxToken}
        turnstileSiteKey={turnstileSiteKey}
        hasSocial={hasSocial}
      />
    );
  },
  loader: async ({ params, deps }): Promise<HostCreateLoaderData> => {
    let market: Market;
    try {
      market = await eventsApi.getMarket({ data: { slug: params.market } });
    } catch (error) {
      if (appErrorCode(error) === 'market_not_found') throw notFound();
      throw error;
    }
    if (params.market !== market.slug) {
      throw redirect({
        to: '/$market/host/create',
        params: { market: market.slug },
        search: { city: deps.city },
      });
    }
    const city = deps.city
      ? await eventsApi.getCity({
          data: { country: market.code, cityCode: deps.city },
        })
      : null;
    const [mapboxToken, authConfig] = await Promise.all([
      eventsApi.getMapboxToken(),
      getPublicAuthConfig(),
    ]);
    return {
      market,
      city: city ?? null,
      mapboxToken,
      turnstileSiteKey: authConfig.turnstileSiteKey,
      hasSocial: authConfig.hasSocial,
    };
  },
});
