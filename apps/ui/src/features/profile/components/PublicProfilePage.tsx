import {
  event_past,
  hosted_events,
  profile_interests_label,
  profile_photo_of,
  profile_view_link,
  public_no_events,
  type Locale,
} from '@founders-coffee/i18n';

import { ExternalLink } from 'lucide-react';

import { EventCard } from '../../../components/events/EventCard';
import { LoadMoreEvents } from '../../../components/events/LoadMoreEvents';
import { useHostedEvents } from '../../events/hooks';
import { useEventPages } from '../../events/useEventPages';
import { initials } from '../../../lib/utils';
import { hostedPaginationQuery } from '../../../lib/public-pagination';
import { profilePhotoUrl } from '../photo-url';
import { localeLabel, topicLabel } from '../profile-labels';
import type { EventFeedItem } from '../../events/api';
import type { Market } from '../../markets/api';
import type { PublicProfile } from '../api';

const PAGE_SIZE = 12;

export const PublicProfilePage = ({
  locale,
  profile,
  events,
  eventsNextCursor,
  eventsTotal,
  beforeStartsAt,
  beforeId,
  markets,
}: {
  locale: Locale;
  profile: PublicProfile;
  events: readonly EventFeedItem[];
  eventsNextCursor?: { startsAt: number; id: string } | null;
  eventsTotal: number;
  beforeStartsAt?: number;
  beforeId?: string;
  markets: readonly Market[];
}) => {
  const pagination = useEventPages(
    useHostedEvents(
      {
        hostId: profile.userId,
        beforeStartsAt,
        beforeId,
        limit: PAGE_SIZE,
      },
      {
        initialPage: {
          items: events,
          nextCursor: eventsNextCursor ?? null,
          total: eventsTotal,
        },
      },
    ),
    events,
  );
  const now = Date.now();
  const marketByCode = new Map(markets.map((market) => [market.code, market]));
  const visibleEvents = pagination.items.filter((event) =>
    marketByCode.has(event.marketCode),
  );

  return (
    <section className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <article
        aria-labelledby="public-profile-title"
        className="rounded-box bg-base-200 p-5 sm:p-8"
      >
        <header className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div
              className="avatar avatar-placeholder shrink-0"
              aria-hidden={profile.photoAssetId ? undefined : true}
            >
              <div className="w-16 rounded-full bg-neutral text-neutral-content">
                {profile.photoAssetId ? (
                  <img
                    src={profilePhotoUrl(profile.photoAssetId, 'md')}
                    alt={profile_photo_of(
                      { name: profile.displayName },
                      { locale },
                    )}
                    width={64}
                    height={64}
                    className="rounded-full object-cover"
                  />
                ) : (
                  <span className="text-h3">
                    {initials(profile.displayName)}
                  </span>
                )}
              </div>
            </div>
            <h1
              id="public-profile-title"
              className="font-display text-h2 font-semibold break-words"
            >
              <bdi>{profile.displayName}</bdi>
            </h1>
          </div>
          {profile.professionalLink ? (
            <a
              href={profile.professionalLink}
              target="_blank"
              rel="noreferrer nofollow ugc"
              dir="ltr"
              aria-label={`${profile_view_link({}, { locale })}: ${profile.professionalLink}`}
              className="btn btn-outline h-10 min-h-10 shrink-0 self-start px-3"
            >
              <span>{profile_view_link({}, { locale })}</span>
              <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          ) : null}
        </header>

        <div className="mt-6 flex flex-col gap-4">
          {profile.introduction ? (
            <p
              dir="auto"
              className="max-w-prose whitespace-pre-wrap break-words text-body-lg"
            >
              {profile.introduction}
            </p>
          ) : null}
          {profile.interests.length > 0 ? (
            <ul
              className="flex flex-wrap gap-2"
              aria-label={profile_interests_label({}, { locale })}
            >
              {profile.interests.map((topic) => (
                <li
                  key={topic}
                  className="rounded-full bg-base-100 px-3 py-1 text-body-sm"
                >
                  {topicLabel(topic, locale)}
                </li>
              ))}
            </ul>
          ) : null}
          {profile.spokenLanguages.length > 0 ? (
            <p dir="auto" className="text-body-sm text-neutral">
              {profile.spokenLanguages
                .map((spoken) => localeLabel(spoken, locale))
                .join(' · ')}
            </p>
          ) : null}
        </div>
      </article>

      <section aria-labelledby="hosted-events-title" className="mt-10">
        <header className="mb-5 flex items-end justify-between gap-4">
          <h2
            id="hosted-events-title"
            className="font-display text-h3 font-semibold"
          >
            {hosted_events({}, { locale })}
          </h2>
        </header>
        {visibleEvents.length === 0 ? (
          <p role="status" className="text-body-sm text-neutral">
            {public_no_events({}, { locale })}
          </p>
        ) : (
          <>
            <ul className="grid gap-3">
              {visibleEvents.map((event) => {
                const market = marketByCode.get(event.marketCode);
                if (!market) return null;
                return (
                  <li key={event.id}>
                    {new Date(event.startsAt).getTime() < now ? (
                      <p className="mb-1 text-caption text-neutral">
                        {event_past({}, { locale })}
                      </p>
                    ) : null}
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
            <LoadMoreEvents
              locale={locale}
              pagination={pagination}
              nextPageHref={
                eventsNextCursor
                  ? `/u/${encodeURIComponent(profile.userId)}?${hostedPaginationQuery(eventsNextCursor)}`
                  : undefined
              }
            />
          </>
        )}
      </section>
    </section>
  );
};
