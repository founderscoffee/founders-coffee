import { useState, type KeyboardEvent } from 'react';

import {
  activity_hosted,
  activity_hosted_empty,
  activity_joined,
  activity_joined_empty,
  activity_loading,
  activity_note,
  activity,
  activity_unavailable,
  type Locale,
} from '@founders-coffee/i18n';
import { LoadingStatus, StatusMessage } from '@founders-coffee/ui';

import { useChatUnreadCounts } from '../../chat/hooks';
import { useMyCloseoutStates } from '../../operations/hooks';
import { ProfileSectionNav } from '../../account/components/ProfileSectionNav';
import { ProfileAccess } from '../../profile/components/ProfileAccess';
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

type ActivityTab = 'joined' | 'hosted';

const tabIds: readonly ActivityTab[] = ['joined', 'hosted'];
const ACTIVITY_PAGE_SIZE = 10;

export const ActivityPage = ({
  locale,
  markets,
}: {
  locale: Locale;
  markets: readonly { code: string; slug: string }[];
}) => {
  const [activeTab, setActiveTab] = useState<ActivityTab>('joined');
  const joined = useMyJoinedEvents({ limit: ACTIVITY_PAGE_SIZE });
  const { userId, isAuthLoading } = joined;
  const hosted = useHostedEvents({
    hostId: userId ?? '',
    limit: ACTIVITY_PAGE_SIZE,
  });
  const joinedItems = flatten(joined.data?.pages);
  const hostedItems = flatten(hosted.data?.pages);
  const closeoutStates = useMyCloseoutStates(closeoutCandidates(hostedItems));
  const unreadChats = useChatUnreadCounts(
    [...joinedItems, ...hostedItems].map((item) => item.id),
  );
  const chatsWithUnread = new Set(
    [...unreadChats].filter(([, unread]) => unread > 0).map(([id]) => id),
  );
  const closeoutByEvent = new Map(
    (closeoutStates.data ?? []).map((state) => [state.eventId, state]),
  );

  const marketSlugFor = (code: string) =>
    markets.find((market) => market.code === code)?.slug ?? code;

  const isLoading = isAuthLoading || (!!userId && joined.isPending);

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const currentTab = event.currentTarget.dataset.tab as ActivityTab;
    const currentIndex = tabIds.indexOf(currentTab);
    const offset = event.key === 'ArrowRight' ? 1 : -1;
    const nextIndex = (currentIndex + offset + tabIds.length) % tabIds.length;
    event.preventDefault();
    setActiveTab(tabIds[nextIndex]);
  };

  const joinedTabId = 'activity-joined-tab';
  const hostedTabId = 'activity-hosted-tab';
  const joinedPanelId = 'activity-joined-panel';
  const hostedPanelId = 'activity-hosted-panel';

  return (
    <section className="mx-auto max-w-5xl px-5 py-12 lg:grid lg:grid-cols-[184px_minmax(0,1fr)] lg:gap-12">
      <ProfileSectionNav locale={locale} />
      <div className="min-w-0">
        <h1 className="mb-1 font-display text-h3">
          {activity({}, { locale })}
        </h1>
        <p className="mb-6 text-body-sm text-neutral">
          {activity_note({}, { locale })}
        </p>

        {!userId && !isAuthLoading ? (
          <ProfileAccess
            locale={locale}
            isLoading={false}
            isAnonymous
            returnPath={`/${locale}/profile/activity`}
            onRetry={() => void joined.refetch()}
          />
        ) : isLoading ? (
          <LoadingStatus label={activity_loading({}, { locale })} />
        ) : joined.isError ? (
          <StatusMessage variant="error">
            {activity_unavailable({}, { locale })}
          </StatusMessage>
        ) : (
          <div
            className="tabs tabs-lift tabs-sm w-full md:tabs-md"
            role="tablist"
            aria-label={activity({}, { locale })}
          >
            <button
              id={joinedTabId}
              type="button"
              role="tab"
              className={`tab ${activeTab === 'joined' ? 'tab-active' : ''}`}
              aria-controls={joinedPanelId}
              aria-selected={activeTab === 'joined'}
              data-tab="joined"
              tabIndex={activeTab === 'joined' ? 0 : -1}
              onClick={() => setActiveTab('joined')}
              onKeyDown={handleTabKeyDown}
            >
              {activity_joined({}, { locale })}
            </button>
            <button
              id={hostedTabId}
              type="button"
              role="tab"
              className={`tab ${activeTab === 'hosted' ? 'tab-active' : ''}`}
              aria-controls={hostedPanelId}
              aria-selected={activeTab === 'hosted'}
              data-tab="hosted"
              tabIndex={activeTab === 'hosted' ? 0 : -1}
              onClick={() => setActiveTab('hosted')}
              onKeyDown={handleTabKeyDown}
            >
              {activity_hosted({}, { locale })}
            </button>
            <div
              id={joinedPanelId}
              role="tabpanel"
              aria-labelledby={joinedTabId}
              className={`tab-content border-base-300 bg-base-100 p-0 pt-4 md:pt-5 ${activeTab === 'joined' ? 'block' : ''}`}
              hidden={activeTab !== 'joined'}
            >
              <ActivityList
                locale={locale}
                emptyNote={activity_joined_empty({}, { locale })}
                items={joinedItems}
                total={joined.data?.pages[0]?.total ?? 0}
                marketSlugFor={marketSlugFor}
                hasMore={!!joined.hasNextPage}
                isLoadingMore={joined.isFetchingNextPage}
                onLoadMore={() => void joined.fetchNextPage()}
                chatsWithUnread={chatsWithUnread}
              />
            </div>
            <div
              id={hostedPanelId}
              role="tabpanel"
              aria-labelledby={hostedTabId}
              className={`tab-content border-base-300 bg-base-100 p-0 pt-4 md:pt-5 ${activeTab === 'hosted' ? 'block' : ''}`}
              hidden={activeTab !== 'hosted'}
            >
              <ActivityList
                locale={locale}
                emptyNote={activity_hosted_empty({}, { locale })}
                items={hostedItems}
                total={hosted.data?.pages[0]?.total ?? 0}
                marketSlugFor={marketSlugFor}
                hasMore={!!hosted.hasNextPage}
                isLoadingMore={hosted.isFetchingNextPage}
                onLoadMore={() => void hosted.fetchNextPage()}
                closeoutStates={closeoutByEvent}
                chatsWithUnread={chatsWithUnread}
              />
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
