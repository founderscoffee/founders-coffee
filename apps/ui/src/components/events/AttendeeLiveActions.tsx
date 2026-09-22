import { useState } from 'react';

import {
  live_cancel,
  live_confirm,
  live_eta_ph,
  live_running_late_cta,
  live_walking_in_cta,
  type Locale,
} from '@founders-coffee/i18n';

type AttendeeLiveActionsProps = {
  locale: Locale;
  onWalkingIn: () => void;
  onRunningLate: (etaMinutes?: number) => void;
};

export const AttendeeLiveActions = ({
  locale,
  onWalkingIn,
  onRunningLate,
}: AttendeeLiveActionsProps) => {
  const [runningLateEta, setRunningLateEta] = useState('');
  const [showRunningLate, setShowRunningLate] = useState(false);

  const handleRunningLate = () => {
    const eta = runningLateEta ? parseInt(runningLateEta, 10) : undefined;
    onRunningLate(eta);
    setShowRunningLate(false);
    setRunningLateEta('');
  };

  return (
    <>
      <div className="divider my-0" />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn btn-success btn-sm"
          onClick={onWalkingIn}
        >
          {live_walking_in_cta({}, { locale })}
        </button>
        {!showRunningLate && (
          <button
            type="button"
            className="btn btn-error btn-outline btn-sm"
            onClick={() => setShowRunningLate(true)}
          >
            {live_running_late_cta({}, { locale })}
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
            type="button"
            className="btn btn-error btn-sm"
            onClick={handleRunningLate}
          >
            {live_confirm({}, { locale })}
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowRunningLate(false)}
          >
            {live_cancel({}, { locale })}
          </button>
        </div>
      )}
    </>
  );
};
