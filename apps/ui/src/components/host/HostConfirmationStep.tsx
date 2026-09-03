import { CalendarClock, MapPin, Users } from 'lucide-react';

import {
  host_capacity,
  host_capacity_unlimited,
  host_category,
  host_confirmation_details,
  host_confirmation_intro,
  host_confirmation_schedule,
  host_confirmation_venue,
  host_desc_label,
  host_duration_min,
  host_language,
  host_login_required,
  host_title_label,
  type Locale,
} from '@founders-coffee/i18n';

import type { VenueSelection } from '../../features/events/types';
import { ScheduleSummary } from './ScheduleSummary';

export const HostConfirmationStep = ({
  locale,
  timeZone,
  venue,
  venueName,
  startsAt,
  endsAt,
  title,
  description,
  capacity,
  languageLabel,
  categoryLabel,
  isAuthenticated,
  publishError,
}: {
  locale: Locale;
  timeZone: string;
  venue: VenueSelection;
  venueName: string;
  startsAt: number;
  endsAt: number;
  title: string;
  description: string;
  capacity: number;
  languageLabel: string;
  categoryLabel: string;
  isAuthenticated: boolean;
  publishError: string | null;
}) => (
  <div className="grid gap-5">
    <p className="text-base-content/65">
      {host_confirmation_intro({}, { locale })}
    </p>

    <section className="rounded-xl border border-base-300 p-4">
      <h3 className="flex items-center gap-2 font-semibold">
        <MapPin className="size-4 text-primary" aria-hidden="true" />
        {host_confirmation_venue({}, { locale })}
      </h3>
      <p className="mt-2 font-semibold" dir="auto">
        {venueName || venue.name}
      </p>
      <p className="mt-1 text-sm text-base-content/65" dir="auto">
        {venue.address}
      </p>
    </section>

    <section aria-labelledby="host-confirmation-schedule">
      <h3
        id="host-confirmation-schedule"
        className="mb-2 flex items-center gap-2 font-semibold"
      >
        <CalendarClock className="size-4 text-primary" aria-hidden="true" />
        {host_confirmation_schedule({}, { locale })}
      </h3>
      <ScheduleSummary
        startsAt={startsAt}
        endsAt={endsAt}
        locale={locale}
        timeZone={timeZone}
      />
      <p className="mt-2 text-sm text-base-content/65">
        {host_duration_min(
          { n: Math.round((endsAt - startsAt) / 60_000) },
          { locale },
        )}
      </p>
    </section>

    <section className="rounded-xl border border-base-300 p-4">
      <h3 className="font-semibold">
        {host_confirmation_details({}, { locale })}
      </h3>
      <dl className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold text-base-content/50">
            {host_title_label({}, { locale })}
          </dt>
          <dd className="mt-1 font-semibold" dir="auto">
            {title}
          </dd>
        </div>
        <div className="sm:col-span-2">
          <dt className="text-xs font-semibold text-base-content/50">
            {host_desc_label({}, { locale })}
          </dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm" dir="auto">
            {description}
          </dd>
        </div>
        <div>
          <dt className="flex items-center gap-1 text-xs font-semibold text-base-content/50">
            <Users className="size-3.5" aria-hidden="true" />
            {host_capacity({}, { locale })}
          </dt>
          <dd className="mt-1">
            {capacity === 0
              ? host_capacity_unlimited({}, { locale })
              : capacity}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-base-content/50">
            {host_language({}, { locale })}
          </dt>
          <dd className="mt-1">{languageLabel}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold text-base-content/50">
            {host_category({}, { locale })}
          </dt>
          <dd className="mt-1">{categoryLabel}</dd>
        </div>
      </dl>
    </section>

    {!isAuthenticated && (
      <p
        className="rounded-xl border border-info/30 bg-info/10 p-4 text-sm"
        role="status"
      >
        {host_login_required({}, { locale })}
      </p>
    )}
    {publishError && (
      <p className="text-sm text-error" role="alert">
        {publishError}
      </p>
    )}
  </div>
);
