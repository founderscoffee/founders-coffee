import { CalendarClock } from 'lucide-react';

import {
  direction,
  formatScheduleDateTime,
  host_selected_time,
  type Locale,
} from '@founders-coffee/i18n';

type ScheduleSummaryProps = {
  startsAt: number;
  endsAt: number;
  locale: Locale;
  timeZone: string;
};

export const ScheduleSummary = ({
  startsAt,
  endsAt,
  locale,
  timeZone,
}: ScheduleSummaryProps) => {
  const label = host_selected_time({}, { locale });
  const start = formatScheduleDateTime(startsAt, locale, timeZone);
  const end = formatScheduleDateTime(endsAt, locale, timeZone);

  return (
    <section
      className="rounded-xl border border-base-300 bg-base-200 p-3"
      aria-label={label}
      dir={direction(locale)}
    >
      <div className="flex items-start gap-2">
        <CalendarClock
          className="mt-0.5 size-4 shrink-0 text-primary"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <h3 className="eyebrow">{label}</h3>
          <p className="mt-1 text-body-sm font-semibold text-base-content">
            <time dateTime={new Date(startsAt).toISOString()}>{start}</time>
            <span aria-hidden="true"> – </span>
            <time dateTime={new Date(endsAt).toISOString()}>{end}</time>
          </p>
          <p className="mt-1 text-caption text-neutral">{timeZone}</p>
        </div>
      </div>
    </section>
  );
};
