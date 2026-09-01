import { useState } from 'react';

import {
  useEventLive,
  type RosterUser,
  type ConnectionState,
} from '../useEventLive';

export interface LiveDashboardProps {
  eventId: string;
  currentUserId: string;
  isHost: boolean;
}

const statusLabel = (status: RosterUser['status']): string => {
  switch (status) {
    case 'arrived':
      return 'At the venue';
    case 'walking_in':
      return 'Walking in';
    case 'running_late':
      return 'Running late';
    case 'connected':
      return 'Connected';
  }
};

const statusColor = (status: RosterUser['status']): string => {
  switch (status) {
    case 'arrived':
      return 'badge-success';
    case 'walking_in':
      return 'badge-warning';
    case 'running_late':
      return 'badge-error';
    case 'connected':
      return 'badge-ghost';
  }
};

const connectionBadge = (state: ConnectionState): string => {
  switch (state) {
    case 'connected':
      return 'badge-success';
    case 'connecting':
    case 'authenticating':
      return 'badge-warning';
    case 'disconnected':
      return 'badge-ghost';
    case 'error':
      return 'badge-error';
  }
};

export const LiveDashboard = ({
  eventId,
  currentUserId,
  isHost,
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
          <h2 className="card-title text-lg">Live Dashboard</h2>
          <div className="flex items-center gap-2">
            <span
              className={`badge badge-sm ${connectionBadge(connectionState)}`}
            >
              {connectionState === 'connected' ? 'LIVE' : connectionState}
            </span>
            {host?.arrived && (
              <span className="badge badge-success badge-sm">Host here</span>
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
            <p className="text-sm font-medium opacity-70">Host</p>
            {host.arrived ? (
              <div className="mt-1">
                <p className="font-semibold">
                  {host.visualCue ?? 'At the venue'}
                </p>
                {host.tableNumber && (
                  <p className="text-sm opacity-70">Table {host.tableNumber}</p>
                )}
              </div>
            ) : (
              <p className="mt-1 text-sm opacity-50">Not yet arrived</p>
            )}
          </div>
        )}

        <div>
          <p className="text-sm font-medium opacity-70">
            In the Room ({arrivedCount}/{totalCount})
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
                  <span className="ml-1 text-xs">
                    {statusLabel(user.status)}
                    {user.etaMinutes && ` (${user.etaMinutes}m)`}
                  </span>
                )}
              </div>
            ))}
            {roster.length === 0 && (
              <p className="text-sm opacity-50">No attendees connected yet</p>
            )}
          </div>
        </div>

        {isHost && !host?.arrived && (
          <div className="divider">Host Actions</div>
        )}

        {isHost && !host?.arrived && !showArrivedForm && (
          <button
            className="btn btn-primary btn-block"
            onClick={() => setShowArrivedForm(true)}
          >
            I've Arrived
          </button>
        )}

        {isHost && showArrivedForm && (
          <div className="flex flex-col gap-2">
            <input
              type="number"
              className="input input-bordered input-sm"
              placeholder="Table number (optional)"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
            />
            <input
              type="text"
              className="input input-bordered input-sm"
              placeholder="Visual cue - e.g. wearing a green cap"
              value={visualCue}
              onChange={(e) => setVisualCue(e.target.value)}
            />
            <div className="flex gap-2">
              <button
                className="btn btn-primary btn-sm"
                onClick={handleArrived}
              >
                Confirm
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={() => setShowArrivedForm(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {isHost && host?.arrived && host.tableNumber && (
          <div className="flex gap-2">
            <input
              type="number"
              className="input input-bordered input-sm flex-1"
              placeholder="New table number"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
            />
            <button
              className="btn btn-sm"
              disabled={!tableNumber}
              onClick={() => sendTablePin(parseInt(tableNumber, 10))}
            >
              Update Table
            </button>
          </div>
        )}

        {!isHost && (
          <>
            <div className="divider">Your Status</div>
            <div className="flex gap-2">
              <button
                className="btn btn-success btn-sm"
                onClick={sendWalkingIn}
              >
                Walking In
              </button>
              {!showRunningLate && (
                <button
                  className="btn btn-error btn-outline btn-sm"
                  onClick={() => setShowRunningLate(true)}
                >
                  Running Late
                </button>
              )}
            </div>
            {showRunningLate && (
              <div className="flex gap-2">
                <input
                  type="number"
                  className="input input-bordered input-sm flex-1"
                  placeholder="ETA in minutes"
                  value={runningLateEta}
                  onChange={(e) => setRunningLateEta(e.target.value)}
                />
                <button
                  className="btn btn-error btn-sm"
                  onClick={handleRunningLate}
                >
                  Confirm
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setShowRunningLate(false)}
                >
                  Cancel
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
