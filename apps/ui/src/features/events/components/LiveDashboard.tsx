import { useState } from 'react';

import {
  live_at_venue,
  live_cancel,
  live_confirm,
  live_connected,
  live_eta_minutes,
  live_eta_ph,
  live_host_here,
  live_in_the_room,
  live_no_attendees,
  live_not_arrived,
  live_running_late,
  live_table_n,
  live_title,
  live_walking_in,
  live_your_status,
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
  isHost: boolean;
  locale: Locale;
}

export const LiveDashboard = ({
  live,
  currentUserId,
  isHost,
  locale,
}: LiveDashboardProps) => {
  const {
    roster,
    host,
    connectionState,
    error,
    sendWalkingIn,
    sendRunningLate,
  } = live;

  const [runningLateEta, setRunningLateEta] = useState<string>('');
  const [showRunningLate, setShowRunningLate] = useState(false);

  const arrivedCount = roster.filter((r) => r.status === 'arrived').length;
  const totalCount = roster.length;

  const handleRunningLate = () => {
    const eta = runningLateEta ? parseInt(runningLateEta, 10) : undefined;
    sendRunningLate(eta);
    setShowRunningLate(false);
    setRunningLateEta('');
  };

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
                ? live_connected({}, { locale })
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

        {!isHost && (
          <>
            <div className="divider">{live_your_status({}, { locale })}</div>
            <div className="flex gap-2">
              <button
                className="btn btn-success btn-sm"
                onClick={sendWalkingIn}
              >
                {live_walking_in({}, { locale })}
              </button>
              {!showRunningLate && (
                <button
                  className="btn btn-error btn-outline btn-sm"
                  onClick={() => setShowRunningLate(true)}
                >
                  {live_running_late({}, { locale })}
                </button>
              )}
            </div>
            {showRunningLate && (
              <div className="flex gap-2">
                <input
                  type="number"
                  className="input input-bordered input-sm flex-1"
                  placeholder={live_eta_ph({}, { locale })}
                  value={runningLateEta}
                  onChange={(e) => setRunningLateEta(e.target.value)}
                />
                <button
                  className="btn btn-error btn-sm"
                  onClick={handleRunningLate}
                >
                  {live_confirm({}, { locale })}
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowRunningLate(false)}
                >
                  {live_cancel({}, { locale })}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
