import { createFileRoute, notFound, redirect } from '@tanstack/react-router';
import { z } from 'zod';

import { appErrorCode } from '@founders-coffee/core';
import { detectLocale } from '@founders-coffee/i18n';

import { eventsApi } from '../../features/events/api';
import { readCookieHeader } from '../../lib/cookies';
import { localizedHostCreate } from '../../lib/locale-routing';
import { NO_INDEX_VALUE } from '../../lib/indexation';

export const Route = createFileRoute('/$market/host/create')({
  preload: false,
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
  loader: async ({ params, deps }): Promise<never> => {
    let slug: string;
    try {
      slug = (await eventsApi.getMarket({ data: { slug: params.market } }))
        .slug;
    } catch (error) {
      if (appErrorCode(error) === 'market_not_found') throw notFound();
      throw error;
    }
    throw redirect({
      ...localizedHostCreate(detectLocale(readCookieHeader()), slug),
      search: deps,
    });
  },
  head: () => ({ meta: [], links: [] }),
});
