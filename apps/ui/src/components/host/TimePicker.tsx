import { useEffect, useRef } from 'react';
import { PluginRegistry, TimepickerUI } from 'timepicker-ui';
import { RangePlugin } from 'timepicker-ui/plugins/range';

import {
  host_time,
  host_time_cancel,
  host_time_from,
  host_time_ok,
  host_time_to,
  type Locale,
} from '@founders-coffee/i18n';

PluginRegistry.register(RangePlugin);

type TimePickerProps = {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
  locale: Locale;
};

const pad = (n: number) => String(n).padStart(2, '0');

type RangeManager = {
  setActivePart: (p: 'from' | 'to') => void;
  handleMinuteCommit: (v: { hour: string; minutes: string }) => void;
};
const getRangeManager = (picker: TimepickerUI): RangeManager | undefined => {
  const plugins = (
    picker as unknown as {
      managers: {
        plugins: { range?: RangeManager; get?: (k: string) => RangeManager };
      };
    }
  ).managers.plugins;
  return plugins.range ?? plugins.get?.('range');
};

export const TimePicker = ({ from, to, onChange, locale }: TimePickerProps) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;

    const labels = {
      ok: host_time_ok({}, { locale }),
      cancel: host_time_cancel({}, { locale }),
      fromLabel: host_time_from({}, { locale }),
      toLabel: host_time_to({}, { locale }),
    };
    const picker = new TimepickerUI(el, {
      clock: { type: '24h' },
      range: {
        enabled: true,
        minDuration: 30,
        maxDuration: 480,
        fromLabel: labels.fromLabel,
        toLabel: labels.toLabel,
      },
      labels: { ok: labels.ok, cancel: labels.cancel },
      callbacks: {
        onRangeConfirm: (data) => {
          if (data.from && data.to) onChangeRef.current(data.from, data.to);
        },
      },
    });
    picker.create();

    const rm = getRangeManager(picker);
    let activePart: 'from' | 'to' = 'from';
    let fromHour = from.slice(0, 2);
    let fromMin = from.slice(3, 5);
    let fromDirty = false;

    if (rm) {
      const linkEnd = () => {
        rm.setActivePart('to');
        rm.handleMinuteCommit({
          hour: pad((Number(fromHour) + 1) % 24),
          minutes: fromMin,
        });
      };
      picker.on('range:switch', (d) => {
        activePart = d.active;
        if (d.active === 'to' && fromDirty) {
          fromDirty = false;
          linkEnd();
        }
      });
      picker.on('select:hour', (d) => {
        if (activePart === 'from') {
          fromHour = pad(Number(d.hour));
          fromDirty = true;
        }
      });
      picker.on('select:minute', (d) => {
        if (activePart === 'from') {
          fromMin = pad(Number(d.minutes));
          fromDirty = true;
        }
      });
    }

    return () => picker.destroy();
  }, []);

  return (
    <input
      ref={inputRef}
      id="host-schedule"
      type="text"
      readOnly
      dir="ltr"
      defaultValue={`${from} - ${to}`}
      className="input input-bordered w-full cursor-pointer text-center text-base font-semibold tabular-nums"
      aria-label={host_time({}, { locale })}
    />
  );
};
