import { useState } from 'react';

import {
  live_arrived_cta,
  live_cancel,
  live_confirm,
  live_cue_ph,
  live_new_table_ph,
  live_table_ph,
  live_update_table,
  type Locale,
} from '@founders-coffee/i18n';

import type { HostState } from '../../features/events/useEventLive';

type HostLiveActionsProps = {
  locale: Locale;
  host: HostState | null;
  onArrived: (tableNumber?: number, visualCue?: string) => void;
  onTablePin: (tableNumber: number) => void;
};

export const HostLiveActions = ({
  locale,
  host,
  onArrived,
  onTablePin,
}: HostLiveActionsProps) => {
  const [tableNumber, setTableNumber] = useState('');
  const [visualCue, setVisualCue] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const confirmArrival = () => {
    const table = tableNumber ? parseInt(tableNumber, 10) : undefined;
    onArrived(
      Number.isFinite(table) ? table : undefined,
      visualCue || undefined,
    );
    setIsFormOpen(false);
  };

  if (host?.arrived) {
    return (
      <div className="flex gap-2">
        <input
          type="number"
          className="input input-bordered input-sm flex-1"
          placeholder={live_new_table_ph({}, { locale })}
          value={tableNumber}
          onChange={(event) => setTableNumber(event.target.value)}
        />
        <button
          type="button"
          className="btn btn-sm"
          disabled={!tableNumber}
          onClick={() => onTablePin(parseInt(tableNumber, 10))}
        >
          {live_update_table({}, { locale })}
        </button>
      </div>
    );
  }

  if (!isFormOpen) {
    return (
      <button
        type="button"
        className="btn btn-primary btn-block"
        onClick={() => setIsFormOpen(true)}
      >
        {live_arrived_cta({}, { locale })}
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="number"
        className="input input-bordered input-sm w-full"
        placeholder={live_table_ph({}, { locale })}
        value={tableNumber}
        onChange={(event) => setTableNumber(event.target.value)}
      />
      <input
        type="text"
        className="input input-bordered input-sm w-full"
        placeholder={live_cue_ph({}, { locale })}
        value={visualCue}
        onChange={(event) => setVisualCue(event.target.value)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={confirmArrival}
        >
          {live_confirm({}, { locale })}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => setIsFormOpen(false)}
        >
          {live_cancel({}, { locale })}
        </button>
      </div>
    </div>
  );
};
