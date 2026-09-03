import {
  public_events_hosted,
  public_no_events,
  role_admin,
  role_host,
  role_member,
  type Locale,
} from '@founders-coffee/i18n';
import type { Market } from '@founders-coffee/db';
import type { EventFeedItem, PublicProfile } from '@founders-coffee/server-fns';

import { EventCard } from '../events/EventCard';
import { initials } from '../../lib/utils';

type PublicProfilePageProps = {
  locale: Locale;
  profile: PublicProfile;
  events: readonly EventFeedItem[];
  markets: readonly Market[];
};

export const PublicProfilePage = ({
  locale,
  profile,
  events,
  markets,
}: PublicProfilePageProps) => {
  const roleLabel =
    profile.role === 'host'
      ? role_host({}, { locale })
      : profile.role === 'admin'
        ? role_admin({}, { locale })
        : role_member({}, { locale });

  const cityName =
    locale === 'ar' ? profile.homeCityNameAr : profile.homeCityName;

  const marketFor = (code: string) => markets.find((m) => m.code === code);

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="card border border-base-300 bg-base-200">
        <div className="card-body items-center gap-4 text-center">
          <div className="avatar avatar-placeholder">
            <div className="w-20 rounded-full bg-neutral text-neutral-content">
              <span className="text-2xl font-bold">
                {initials(profile.name)}
              </span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold">{profile.name}</h1>
            <span className="badge badge-outline badge-sm mt-1">
              {roleLabel}
            </span>
          </div>

          {cityName && (
            <p className="text-sm text-base-content/60">{cityName}</p>
          )}

          <div className="divider" />

          <div className="stats stats-horizontal bg-base-100 shadow-sm">
            <div className="stat">
              <div className="stat-title text-xs">
                {public_events_hosted({}, { locale })}
              </div>
              <div className="stat-value text-2xl">{events.length}</div>
            </div>
          </div>

          {events.length === 0 ? (
            <p className="text-sm text-base-content/40">
              {public_no_events({}, { locale })}
            </p>
          ) : (
            <ul className="grid w-full gap-3 text-start">
              {events.map((event) => {
                const market = marketFor(event.marketCode);
                if (!market) return null;
                return (
                  <li key={event.id}>
                    <EventCard
                      event={event}
                      locale={locale}
                      timezone={market.timezone}
                      marketSlug={market.slug}
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
