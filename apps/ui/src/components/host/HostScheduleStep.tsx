import type { Locale, ZonedDateTimeError } from '@founders-coffee/i18n';
import { StatusMessage } from '@founders-coffee/ui';

import { DatetimePicker } from './DatetimePicker';

type HostScheduleStepProps = {
  locale: Locale;
  timeZone: string;
  startsAt: number | null;
  endsAt: number | null;
  error?: string;
  onChange: (startsAt: number | null, endsAt: number | null) => void;
  onError: (error: ZonedDateTimeError | null) => void;
};

export const HostScheduleStep = ({
  locale,
  timeZone,
  startsAt,
  endsAt,
  error,
  onChange,
  onError,
}: HostScheduleStepProps) => (
  <div>
    <DatetimePicker
      startsAt={startsAt}
      endsAt={endsAt}
      onChange={onChange}
      onError={onError}
      locale={locale}
      timeZone={timeZone}
      timePlacement="top"
    />
    {error && (
      <StatusMessage variant="error" className="mt-3">
        {error}
      </StatusMessage>
    )}
  </div>
);
