import { Link } from '@tanstack/react-router';

import { event_host, profile_link, type Locale } from '@founders-coffee/i18n';
import type { PublicProfile } from '@founders-coffee/server-fns';

import { localizedPublicProfile } from '../../lib/locale-routing';
import { initials } from '../../lib/utils';

type EventHostCardProps = {
  locale: Locale;
  host: PublicProfile | null;
  cityName: string;
};

export const EventHostCard = ({
  locale,
  host,
  cityName,
}: EventHostCardProps) => (
  <section className="mt-6 rounded-box border border-base-300 bg-base-100 p-4">
    <h3 className="eyebrow">{event_host({}, { locale })}</h3>
    <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 gap-y-3 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-full bg-base-200 text-body-sm font-semibold"
      >
        {initials(host?.displayName ?? '') || '?'}
      </span>
      <span className="min-w-0">
        {host ? (
          <span className="block font-display font-semibold wrap-break-word">
            <bdi>{host.displayName}</bdi>
          </span>
        ) : null}
        <span className="block text-body-sm text-neutral">
          <bdi>{cityName}</bdi>
        </span>
      </span>
      {host ? (
        <Link
          {...localizedPublicProfile(locale, host.userId)}
          className="btn btn-outline btn-xs sm:btn-sm md:btn-md col-start-2 w-fit sm:col-start-auto"
        >
          {profile_link({}, { locale })}
        </Link>
      ) : null}
    </div>
  </section>
);
