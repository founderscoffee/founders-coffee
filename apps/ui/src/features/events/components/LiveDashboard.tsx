import {
  live_in_the_room,
  live_title,
  type Locale,
} from '@founders-coffee/i18n';
import { StatusMessage } from '@founders-coffee/ui';

import type { UseEventLiveResult } from '../useEventLive';
import { usePublishLivePresenceWhileMounted } from '../live-presence';
import { liveErrorMessage } from './live-badges';
import { RosterList } from './RosterList';

export interface LiveDashboardProps {
  live: UseEventLiveResult;
  currentUserId: string;
  locale: Locale;
}

export const LiveDashboard = ({
  live,
  currentUserId,
  locale,
}: LiveDashboardProps) => {
  const { roster, host, connectionState, error } = live;

  usePublishLivePresenceWhileMounted(connectionState);

  const arrivedCount = roster.filter((r) => r.status === 'arrived').length;
  const totalCount = roster.length;

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body gap-4">
        <h2 className="card-title font-display text-body-lg font-semibold">
          {live_title({}, { locale })}
          <span className="font-normal text-neutral">
            {' · '}
            {live_in_the_room(
              { arrived: arrivedCount, total: totalCount },
              { locale },
            )}
          </span>
        </h2>

        {error && (
          <StatusMessage variant="error">
            {liveErrorMessage(error, locale)}
          </StatusMessage>
        )}

        <RosterList
          roster={roster}
          host={host}
          currentUserId={currentUserId}
          locale={locale}
        />
      </div>
    </div>
  );
};
