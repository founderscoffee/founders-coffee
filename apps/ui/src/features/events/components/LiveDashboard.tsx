import { useState } from 'react';

import {
  live_arrived_cta,
  live_at_venue,
  live_cancel,
  live_confirm,
  live_connected,
  live_cue_ph,
  live_eta_minutes,
  live_eta_ph,
  live_host_actions,
  live_host_here,
  live_in_the_room,
  live_new_table_ph,
  live_no_attendees,
  live_not_arrived,
  live_running_late,
  live_table_n,
  live_table_ph,
  live_title,
  live_update_table,
  live_walking_in,
  live_your_status,
  role_host,
  type Locale,
} from '@founders-coffee/i18n';

import { useEventLive } from '../useEventLive';
import { connectionBadge, statusColor, statusLabel } from './live-badges';

export interface LiveDashboardProps {
  eventId: string;
  currentUserId: string;
  isHost: boolean;
  locale: Locale;
}

export const LiveDashboard = ({
  eventId,
  currentUserId,
  isHost,
  locale,
}: LiveDashboardProps) => {
  const {
    roster,
    host,
    connectionState,
    error,
    sendArrived,
    sendWalkingIn,
    sendRunningLate,
    sendTablePin,
  } = useEventLive(eventId);

  const [tableNumber, setTableNumber] = useState<string>('');
  const [visualCue, setVisualCue] = useState('');
  const [showArrivedForm, setShowArrivedForm] = useState(false);
  const [runningLateEta, setRunningLateEta] = useState<string>('');
  const [showRunningLate, setShowRunningLate] = useState(false);

  const arrivedCount = roster.filter((r) => r.status === 'arrived').length;
  const totalCount = roster.length;

  const handleArrived = () => {
    if (tableNumber) {
      sendArrived(parseInt(tableNumber, 10), visualCue || undefined);
    } else {
      sendArrived(undefined, visualCue || undefined);
    }
    setShowArrivedForm(false);
  };

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
                : connectionState}
            </span>
            {host?.arrived && (
              <span className="badge badge-success badge-sm">
                {live_host_here({}, { locale })}
              </span>
            )}
          </div>
        </div>

        {error && (
          <div className="alert alert-error alert-sm">
            <span>{error}</span>
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

        {isHost && !host?.arrived && (
          <div className="divider">{live_host_actions({}, { locale })}</div>
        )}

        {isHost && !host?.arrived && !showArrivedForm && (
          <button
            className="btn btn-primary btn-block"
            onClick={() => setShowArrivedForm(true)}
          >
            {live_arrived_cta({}, { locale })}
          </button>
        )}

        {isHost && showArrivedForm && (
          <div className="flex flex-col gap-2">
            <input
              type="number"
              className="input input-bordered input-sm w-full"
              placeholder={live_table_ph({}, { locale })}
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
            />
            <input
              type="text"
              className="input input-bordered input-sm w-full"
              placeholder={live_cue_ph({}, { locale })}
              value={visualCue}
              onChange={(e) => setVisualCue(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="btn btn-primary btn-sm"
                onClick={handleArrived}
              >
                {live_confirm({}, { locale })}
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowArrivedForm(false)}
              >
                {live_cancel({}, { locale })}
              </button>
            </div>
          </div>
        )}

        {isHost && host?.arrived && host.tableNumber && (
          <div className="flex gap-2">
            <input
              type="number"
              className="input input-bordered input-sm flex-1"
              placeholder={live_new_table_ph({}, { locale })}
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
            />
            <button
              className="btn btn-sm"
              disabled={!tableNumber}
              onClick={() => sendTablePin(parseInt(tableNumber, 10))}
            >
              {live_update_table({}, { locale })}
            </button>
          </div>
        )}

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
