import { createFileRoute, notFound } from '@tanstack/react-router';

import { appErrorCode } from '@founders-coffee/core';
import {
  getPublicProfile,
  getUpcomingEvents,
  type EventFeedItem,
  type PublicProfile,
} from '@founders-coffee/server-fns';

import { PublicProfilePage } from '../components/profile/PublicProfilePage';

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
      profile = await getPublicProfile({ data: { userId: params.userId } });
    } catch (error) {
      if (appErrorCode(error) === 'not_found') throw notFound();
      throw error;
    }
    const page = await getUpcomingEvents({
      data: { hostId: params.userId, limit: 20 },
    });
    return { profile, events: page.items };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: `${loaderData?.profile.name ?? 'Profile'} - founders.coffee` },
    ],
  }),
});
