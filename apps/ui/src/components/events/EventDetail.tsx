import { Link } from '@tanstack/react-router';

import {
  cat_coffee_meetup,
  cat_demo_day,
  cat_workshop,
  event_capacity,
  event_free,
  event_host,
  event_no_cap,
  event_when,
  open_in_maps,
  profile_title,
  event_where,
  formatDate,
  type Locale,
} from '@founders-coffee/i18n';
import type { Market } from '@founders-coffee/db';
import type {
  EventDetailItem,
  PublicProfile,
} from '@founders-coffee/server-fns';

import { RsvpSection } from './RsvpSection';

type EventDetailProps = {
  locale: Locale;
  market: Market;
  event: EventDetailItem;
  host: PublicProfile;
};

const LANGUAGE_LABEL: Record<EventDetailItem['language'], string> = {
  ar: 'AR',
  en: 'EN',
  fr: 'FR',
};

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase() || '?';

const categoryLabel = (
  category: EventDetailItem['category'],
  locale: Locale,
): string =>
  category === 'coffee-meetup'
    ? cat_coffee_meetup({}, { locale })
    : category === 'workshop'
      ? cat_workshop({}, { locale })
      : cat_demo_day({}, { locale });

export const EventDetail = ({
  locale,
  market,
  event,
  host,
}: EventDetailProps) => {
  const when = formatDate(event.startsAt, locale, {
    timeZone: market.timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  const marketName =
    locale === 'ar' ? (market.nameAr ?? market.name) : market.name;
  const cityName =
    locale === 'ar' ? (event.cityNameAr ?? event.cityName) : event.cityName;
  const capacityText =
    event.capacity === 0
      ? event_no_cap({}, { locale })
      : `${event_capacity({}, { locale })}: ${event.capacity}`;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description,
    startDate: new Date(event.startsAt).toISOString(),
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    eventStatus: 'https://schema.org/EventScheduled',
    inLanguage: event.language,
    location: {
      '@type': 'Place',
      name: event.venue,
      address: event.venueAddress ?? undefined,
    },
    organizer: { '@type': 'Person', name: host.name },
  };

  return (
    <article className="mx-auto max-w-content px-4 py-8 md:px-8 md:py-10">
      <nav aria-label={market.name} className="mb-4 text-body-sm text-neutral">
        <Link
          to="/$market"
          params={{ market: market.slug }}
          className="transition-colors hover:text-base-content"
        >
          {marketName}
        </Link>
        <span className="mx-1.5" aria-hidden="true">
          ›
        </span>
        <span className="text-base-content">{cityName}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr] lg:items-start">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex h-7 items-center rounded-full bg-base-200 px-3 text-caption font-medium">
              {categoryLabel(event.category, locale)}
            </span>
            <span className="inline-flex h-7 items-center rounded-full bg-base-200 px-3 text-caption font-medium">
              {LANGUAGE_LABEL[event.language]}
            </span>
            {event.isFree ? (
              <span className="inline-flex h-7 items-center rounded-full bg-base-200 px-3 text-caption font-medium">
                {event_free({}, { locale })}
              </span>
            ) : null}
          </div>

          <h1 className="mt-4 font-display text-h2 font-semibold text-balance">
            {event.title}
          </h1>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-box border border-base-300 bg-base-100 p-4">
              <dt className="eyebrow">{event_when({}, { locale })}</dt>
              <dd className="mt-1.5 font-medium">{when}</dd>
              <dd className="mt-0.5 text-body-sm text-neutral">
                {market.timezone}
              </dd>
            </div>
            <div className="rounded-box border border-base-300 bg-base-100 p-4">
              <dt className="eyebrow">{event_where({}, { locale })}</dt>
              <dd className="mt-1.5 font-medium">{event.venue}</dd>
              {event.venueAddress ? (
                <dd className="mt-0.5 text-body-sm text-neutral">
                  {event.venueAddress}
                </dd>
              ) : null}
            </div>
          </dl>

          {event.description ? (
            <p className="mt-6 max-w-prose whitespace-pre-line leading-relaxed">
              {event.description}
            </p>
          ) : null}

          <div className="mt-6 flex items-center gap-3.5 rounded-box border border-base-300 bg-base-100 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-base-200 text-body-sm font-semibold">
              {initials(host.name)}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-display font-semibold">
                {host.name}
              </span>
              <span className="block text-body-sm text-neutral">
                {event_host({}, { locale })}
              </span>
            </span>
            <Link
              to="/u/$userId"
              params={{ userId: host.id }}
              className="btn btn-outline btn-sm"
            >
              {profile_title({}, { locale })}
            </Link>
          </div>
        </div>

        <aside className="flex flex-col gap-3">
          {event.latitude != null && event.longitude != null ? (
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${event.latitude},${event.longitude}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-40 items-end justify-end rounded-box border border-base-300 bg-base-200 p-3"
            >
              <span className="btn btn-sm bg-base-100">
                {open_in_maps({}, { locale })}
              </span>
            </a>
          ) : null}

          <div className="rounded-box border border-base-300 bg-base-100 p-4">
            <p className="mb-3 font-display text-h4 font-semibold">
              {event.isFree ? event_free({}, { locale }) : capacityText}
            </p>
            <RsvpSection event={event} hostName={host.name} locale={locale} />
          </div>

          <p className="text-caption text-neutral">{capacityText}</p>
        </aside>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </article>
  );
};
