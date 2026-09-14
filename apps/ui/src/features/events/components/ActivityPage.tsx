import {
  activity_hosted,
  activity_hosted_empty,
  activity_joined,
  activity_joined_empty,
  activity_loading,
  activity_note,
  activity_title,
  activity_unavailable,
  type Locale,
} from '@founders-coffee/i18n';

import { useMyCloseoutStates } from '../../operations/hooks';
import { ProfileSectionNav } from '../../account/components/ProfileSectionNav';
import { ProfileAccess } from '../../profile/components/ProfileAccess';
import { authClient } from '../../../lib/auth';
import { useHostedEvents, useMyJoinedEvents } from '../hooks';
import { ActivityList, type ActivityItem } from './ActivityList';

const flatten = (
  pages: readonly { items: readonly unknown[] }[] | undefined,
): ActivityItem[] =>
  (pages ?? []).flatMap((page) => page.items as ActivityItem[]);

const closeoutCandidates = (items: readonly ActivityItem[]): string[] =>
  items
    .filter((item) => new Date(item.startsAt).getTime() < Date.now())
    .map((item) => item.id);

export const ActivityPage = ({
  locale,
  markets,
}: {
  locale: Locale;
  markets: readonly { code: string; slug: string }[];
}) => {
  const auth = authClient.useSession();
  const userId = auth.data?.user.id;
  const joined = useMyJoinedEvents();
  const hosted = useHostedEvents({ hostId: userId ?? '' });
  const hostedItems = flatten(hosted.data?.pages);
  const closeoutStates = useMyCloseoutStates(closeoutCandidates(hostedItems));
  const closeoutByEvent = new Map(
    (closeoutStates.data ?? []).map((state) => [state.eventId, state]),
  );

  const marketSlugFor = (code: string) =>
    markets.find((market) => market.code === code)?.slug ?? code;

  const isLoading = auth.isPending || (!!userId && joined.isPending);

  return (
    <section className="mx-auto max-w-5xl px-5 py-12 lg:grid lg:grid-cols-[184px_minmax(0,1fr)] lg:gap-12">
      <ProfileSectionNav locale={locale} />
      <div className="min-w-0">
        <h1 className="mb-1 font-display text-h3">
          {activity_title({}, { locale })}
        </h1>
        <p className="mb-6 text-body-sm text-neutral">
          {activity_note({}, { locale })}
        </p>

        {!userId && !auth.isPending ? (
          <ProfileAccess
            locale={locale}
            isLoading={false}
            isAnonymous
            returnPath="/activity"
            onRetry={() => void joined.refetch()}
          />
        ) : isLoading ? (
          <p role="status">{activity_loading({}, { locale })}</p>
        ) : joined.isError ? (
          <p role="alert" className="text-body-sm text-error">
            {activity_unavailable({}, { locale })}
          </p>
        ) : (
          <div className="space-y-6">
            <ActivityList
              locale={locale}
              title={activity_joined({}, { locale })}
              emptyNote={activity_joined_empty({}, { locale })}
              items={flatten(joined.data?.pages)}
              total={joined.data?.pages[0]?.total ?? 0}
              marketSlugFor={marketSlugFor}
              hasMore={!!joined.hasNextPage}
              isLoadingMore={joined.isFetchingNextPage}
              onLoadMore={() => void joined.fetchNextPage()}
            />
            <ActivityList
              locale={locale}
              title={activity_hosted({}, { locale })}
              emptyNote={activity_hosted_empty({}, { locale })}
              items={hostedItems}
              total={hosted.data?.pages[0]?.total ?? 0}
              marketSlugFor={marketSlugFor}
              hasMore={!!hosted.hasNextPage}
              isLoadingMore={hosted.isFetchingNextPage}
              onLoadMore={() => void hosted.fetchNextPage()}
              closeoutStates={closeoutByEvent}
            />
          </div>
        )}
      </div>
    </section>
  );
};
