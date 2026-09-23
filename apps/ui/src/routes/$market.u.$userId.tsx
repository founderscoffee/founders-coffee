import { createFileRoute, notFound, redirect } from '@tanstack/react-router';

import { appErrorCode } from '@founders-coffee/core';
import { detectLocale, isLocale, profile_title } from '@founders-coffee/i18n';

import { eventsApi, type EventFeedItem } from '../features/events/api';
import { profileApi, type PublicProfile } from '../features/profile/api';
import { PublicProfilePage } from '../features/profile/components/PublicProfilePage';
import { readCookieHeader } from '../lib/cookies';
import { NO_INDEX_VALUE } from '../lib/indexation';
import { localizedPublicProfile } from '../lib/locale-routing';
import {
  hostedPaginationSearchSchema,
  type HostedPaginationSearch,
} from '../lib/public-pagination';
import { buildPageTitle } from '../lib/seo';

export const Route = createFileRoute('/$market/u/$userId')({
  validateSearch: hostedPaginationSearchSchema,
  beforeLoad: ({ params, search }) => {
    if (!isLocale(params.market))
      throw redirect({
        ...localizedPublicProfile(
          detectLocale(readCookieHeader()),
          params.userId,
        ),
        search,
      });
  },
  loaderDeps: ({ search }) => ({
    beforeStartsAt: search.beforeStartsAt,
    beforeId: search.beforeId,
  }),
  component: () => {
    const { locale, markets } = Route.useRouteContext();
    const { profile, events, eventsNextCursor, eventsTotal, pagination } =
      Route.useLoaderData();
    return (
      <PublicProfilePage
        locale={locale}
        profile={profile}
        events={events}
        eventsNextCursor={eventsNextCursor}
        eventsTotal={eventsTotal}
        beforeStartsAt={pagination.beforeStartsAt}
        beforeId={pagination.beforeId}
        markets={markets}
      />
    );
  },
  loader: async ({
    params,
    deps,
  }): Promise<{
    profile: PublicProfile;
    events: readonly EventFeedItem[];
    eventsNextCursor: { startsAt: number; id: string } | null;
    eventsTotal: number;
    pagination: HostedPaginationSearch;
  }> => {
    let profile: PublicProfile;
    try {
      profile = await profileApi.getPublicProfile(params.userId);
    } catch (error) {
      if (appErrorCode(error) === 'not_found') throw notFound();
      throw error;
    }
    const page = await eventsApi.getHostedEvents({
      data: { hostId: params.userId, limit: 12, ...deps },
    });
    return {
      profile,
      events: page.items,
      eventsNextCursor: page.nextCursor,
      eventsTotal: page.total,
      pagination: deps,
    };
  },
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': NO_INDEX_VALUE,
  }),
  staleTime: 0,
  gcTime: 0,
  head: ({ loaderData, match }) => ({
    meta: [
      {
        title: buildPageTitle(
          loaderData?.profile.displayName ??
            profile_title({}, { locale: match.context.locale }),
        ),
      },
      { name: 'robots', content: NO_INDEX_VALUE },
    ],
  }),
});
