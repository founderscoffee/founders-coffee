import { createFileRoute, notFound } from '@tanstack/react-router';

import { appErrorCode } from '@founders-coffee/core';
import { profile_title } from '@founders-coffee/i18n';

import { eventsApi, type EventFeedItem } from '../features/events/api';
import { profileApi, type PublicProfile } from '../features/profile/api';
import { PublicProfilePage } from '../features/profile/components/PublicProfilePage';
import {
  hostedPaginationSearchSchema,
  type HostedPaginationSearch,
} from '../lib/public-pagination';

export const Route = createFileRoute('/u/$userId')({
  validateSearch: hostedPaginationSearchSchema,
  loaderDeps: ({ search }) => ({
    beforeStartsAt: search.beforeStartsAt,
    beforeId: search.beforeId,
  }),
  component: () => {
    const { locale, markets } = Route.useRouteContext();
    const { profile, events, eventsNextCursor, pagination } =
      Route.useLoaderData();
    return (
      <PublicProfilePage
        locale={locale}
        profile={profile}
        events={events}
        eventsNextCursor={eventsNextCursor}
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
      pagination: deps,
    };
  },
  headers: () => ({
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow',
  }),
  staleTime: 0,
  gcTime: 0,
  head: ({ loaderData, match }) => ({
    meta: [
      {
        title: `${loaderData?.profile.displayName ?? profile_title({}, { locale: match.context.locale })} - founders.coffee`,
      },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }),
});
