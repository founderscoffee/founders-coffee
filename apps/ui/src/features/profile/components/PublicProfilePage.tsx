import {
  public_upcoming_events,
  public_no_events,
  type Locale,
} from '@founders-coffee/i18n';

import { EventCard } from '../../../components/events/EventCard';
import { initials } from '../../../lib/utils';
import { localeLabel, roleLabel, topicLabel } from '../profile-labels';
import type { EventFeedItem } from '../../events/api';
import type { Market } from '../../markets/api';
import type { PublicProfile } from '../api';

export const PublicProfilePage = ({
  locale,
  profile,
  events,
  markets,
}: {
  locale: Locale;
  profile: PublicProfile;
  events: readonly EventFeedItem[];
  markets: readonly Market[];
}) => (
  <section className="mx-auto max-w-2xl px-5 py-12">
    <div className="card border border-base-300 bg-base-200">
      <div className="card-body gap-6">
        <div className="flex items-center gap-4">
          <div className="avatar avatar-placeholder" aria-hidden="true">
            <div className="w-16 rounded-full bg-neutral text-neutral-content">
              <span className="text-h3">{initials(profile.displayName)}</span>
            </div>
          </div>
          <h1 className="font-display text-h2 break-words">
            <bdi>{profile.displayName}</bdi>
          </h1>
        </div>
        {profile.introduction && (
          <p
            lang={profile.introductionLocale ?? undefined}
            dir="auto"
            className="whitespace-pre-wrap break-words"
          >
            {profile.introduction}
          </p>
        )}
        {profile.communityRole && (
          <p className="text-body-sm text-accent">
            {roleLabel(profile.communityRole, locale)}
          </p>
        )}
        {profile.interests.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {profile.interests.map((topic) => (
              <li
                key={topic}
                className="rounded-full bg-base-100 px-3 py-1 text-body-sm"
              >
                {topicLabel(topic, locale)}
              </li>
            ))}
          </ul>
        )}
        {profile.spokenLanguages.length > 0 && (
          <p className="text-body-sm text-neutral">
            {profile.spokenLanguages
              .map((spoken) => localeLabel(spoken, locale))
              .join(' · ')}
          </p>
        )}
        {profile.professionalLink && (
          <a
            href={profile.professionalLink}
            target="_blank"
            rel="noreferrer nofollow ugc"
            dir="ltr"
            className="text-body-sm break-all underline"
          >
            {profile.professionalLink}
          </a>
        )}
        <h2 className="font-display text-h3">
          {public_upcoming_events({}, { locale })}
        </h2>
        {events.length === 0 ? (
          <p className="text-body-sm text-neutral">
            {public_no_events({}, { locale })}
          </p>
        ) : (
          <ul className="grid gap-3">
            {events.map((event) => {
              const market = markets.find(
                (item) => item.code === event.marketCode,
              );
              return market ? (
                <li key={event.id}>
                  <EventCard
                    event={event}
                    locale={locale}
                    timezone={market.timezone}
                    marketSlug={market.slug}
                  />
                </li>
              ) : null;
            })}
          </ul>
        )}
      </div>
    </div>
  </section>
);
