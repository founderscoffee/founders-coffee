import { createFileRoute, notFound, redirect } from '@tanstack/react-router';
import { z } from 'zod';

import { appErrorCode } from '@founders-coffee/core';
import { getPublicAuthConfig } from '@founders-coffee/server-fns';
import { host_page_title } from '@founders-coffee/i18n';
import type { Market } from '@founders-coffee/db';
import type { geo } from '@founders-coffee/domain';

import { HostCreatePage } from '../components/host/HostCreatePage';
import { eventsApi, type RepeatEventTemplate } from '../features/events/api';
import { localizedHostCreate } from '../lib/locale-routing';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { privatePageHead } from '../lib/seo-private';

type HostCreateLoaderData = {
  market: Market;
  city: geo.GeoCity | null;
  mapboxToken: string;
  turnstileSiteKey: string | null;
  hasSocial: boolean;
  repeatTemplate: RepeatEventTemplate | null;
};

const REPEAT_OPTIONAL_ERRORS = new Set([
  'event_not_found',
  'forbidden',
  'operations_disabled',
  'repeat_event_not_eligible',
  'repeat_event_not_host',
  'unauthenticated',
]);

const loadRepeatTemplate = async (
  eventId: string | undefined,
): Promise<RepeatEventTemplate | null> => {
  if (!eventId) return null;
  try {
    return await eventsApi.getRepeatEventTemplate({ data: { eventId } });
  } catch (error) {
    if (REPEAT_OPTIONAL_ERRORS.has(appErrorCode(error))) return null;
    throw error;
  }
};

const HostCreateRoute = () => {
  const { locale } = Route.useRouteContext();
  const {
    market,
    city,
    mapboxToken,
    turnstileSiteKey,
    hasSocial,
    repeatTemplate,
  } = Route.useLoaderData();
  return (
    <HostCreatePage
      locale={locale}
      market={market}
      city={city}
      mapboxToken={mapboxToken}
      turnstileSiteKey={turnstileSiteKey}
      hasSocial={hasSocial}
      repeatTemplate={repeatTemplate}
    />
  );
};

export const Route = createFileRoute('/$locale/$market/host/create')({
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  validateSearch: z.object({
    city: z.coerce.string().optional(),
    state: z.coerce.string().optional(),
    repeat: z.coerce.string().min(1).max(64).optional(),
  }),
  loaderDeps: ({ search }) => ({
    city: search.city,
    state: search.state,
    repeat: search.repeat,
  }),
  component: HostCreateRoute,
  loader: async ({ params, deps, context }): Promise<HostCreateLoaderData> => {
    let market: Market;
    try {
      market = await eventsApi.getMarket({ data: { slug: params.market } });
    } catch (error) {
      if (appErrorCode(error) === 'market_not_found') throw notFound();
      throw error;
    }
    if (params.market !== market.slug) {
      throw redirect({
        ...localizedHostCreate(context.locale, market.slug),
        search: deps,
      });
    }
    const repeatTemplate = await loadRepeatTemplate(deps.repeat);
    const repeatCity =
      repeatTemplate?.marketCode === market.code
        ? repeatTemplate.cityCode
        : undefined;
    const cityCode = repeatCity ?? deps.city;
    const city = cityCode
      ? await eventsApi.getCity({
          data: { country: market.code, cityCode },
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
      repeatTemplate:
        repeatTemplate?.marketCode === market.code ? repeatTemplate : null,
    };
  },
  head: ({ match }) =>
    privatePageHead(host_page_title({}, { locale: match.context.locale })),
});
