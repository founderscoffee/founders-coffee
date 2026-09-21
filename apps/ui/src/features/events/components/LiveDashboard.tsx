import {
  live_at_venue,
  live_eta_minutes,
  live_host_here,
  live_in_the_room,
  live_no_attendees,
  live_not_arrived,
  live_status_connected,
  live_table_n,
  live_title,
  role_host,
  type Locale,
} from '@founders-coffee/i18n';

import type { UseEventLiveResult } from '../useEventLive';
import {
  connectionBadge,
  connectionLabel,
  liveErrorMessage,
  statusColor,
  statusLabel,
} from './live-badges';

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

  const arrivedCount = roster.filter((r) => r.status === 'arrived').length;
  const totalCount = roster.length;

  return (
    <div className="card bg-base-100 shadow-md">
      <div className="card-body gap-4">
        <div className="flex items-center justify-between">
          <h2 className="card-title font-display text-body-lg font-semibold">
            {live_title({}, { locale })}
          </h2>
          <div className="flex items-center gap-2">
            <span
              className={`badge badge-sm ${connectionBadge(connectionState)}`}
            >
              {connectionState === 'connected'
                ? live_status_connected({}, { locale })
                : connectionLabel(connectionState, locale)}
            </span>
            {host?.arrived && (
              <span className="badge badge-success badge-sm">
                {live_host_here({}, { locale })}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="alert alert-error alert-sm" role="alert">
            <span>{liveErrorMessage(error, locale)}</span>
          </div>
        )}

        {host && (
          <div className="rounded-box bg-base-200 p-3">
            <p className="text-body-sm font-medium text-neutral">
              {role_host({}, { locale })}
            </p>
            {host.arrived ? (
              <div className="mt-1">
                <p className="font-semibold">
                  {host.visualCue ?? live_at_venue({}, { locale })}
                </p>
                {host.tableNumber && (
                  <p className="text-body-sm text-neutral">
                    {live_table_n({ n: host.tableNumber }, { locale })}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-1 text-body-sm text-neutral">
                {live_not_arrived({}, { locale })}
              </p>
            )}
          </div>
        )}

        <div>
          <p className="text-body-sm font-medium text-neutral">
            {live_in_the_room(
              { arrived: arrivedCount, total: totalCount },
              { locale },
            )}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {roster.map((user) => (
              <div
                key={user.userId}
                className={`badge badge-lg ${statusColor(user.status)} ${
                  user.userId === currentUserId ? 'badge-outline' : ''
                }`}
              >
                {user.name}
                {user.status !== 'connected' && (
                  <span className="ms-1 text-xs">
                    {statusLabel(user.status, locale)}
                    {user.etaMinutes
                      ? ` (${live_eta_minutes({ n: user.etaMinutes }, { locale })})`
                      : null}
                  </span>
                )}
              </div>
            ))}
            {roster.length === 0 && (
              <p className="text-body-sm text-neutral">
                {live_no_attendees({}, { locale })}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
