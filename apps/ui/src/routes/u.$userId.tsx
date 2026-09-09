import { createFileRoute, notFound } from '@tanstack/react-router';

import { appErrorCode } from '@founders-coffee/core';
import { profile_title } from '@founders-coffee/i18n';

import { eventsApi, type EventFeedItem } from '../features/events/api';
import { profileApi, type PublicProfile } from '../features/profile/api';
import { PublicProfilePage } from '../features/profile/components/PublicProfilePage';

export const Route = createFileRoute('/u/$userId')({
  component: () => {
    const { locale, markets } = Route.useRouteContext();
    const { profile, events } = Route.useLoaderData();
    return (
      <PublicProfilePage
        locale={locale}
        profile={profile}
        events={events}
        markets={markets}
      />
    );
  },
  loader: async ({
    params,
  }): Promise<{
    profile: PublicProfile;
    events: readonly EventFeedItem[];
  }> => {
    let profile: PublicProfile;
    try {
      profile = await profileApi.getPublicProfile(params.userId);
    } catch (error) {
      if (appErrorCode(error) === 'not_found') throw notFound();
      throw error;
    }
    const page = await eventsApi.getUpcomingEvents({
      data: { hostId: params.userId, limit: 20 },
    });
    return { profile, events: page.items };
  },
  headers: () => ({ 'Cache-Control': 'private, no-store' }),
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
