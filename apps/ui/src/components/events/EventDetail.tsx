import { Link } from '@tanstack/react-router';

import {
  back_to_city,
  cat_coffee_meetup,
  cat_demo_day,
  cat_workshop,
  chairs_left,
  event_free,
  event_when,
  event_where,
  formatDate,
  open_in_maps,
  profile_link,
  role_host,
  rsvp_event_full,
  rsvp_no_limit,
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
  const on = (value: Date, options: Intl.DateTimeFormatOptions) =>
    formatDate(value, locale, {
      timeZone: market.timezone,
      hour12: false,
      ...options,
    });
  const clock = { hour: '2-digit', minute: '2-digit' } as const;
  const start = new Date(event.startsAt);
  const end = event.endsAt == null ? null : new Date(event.endsAt);
  const day = on(start, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const times =
    end == null
      ? on(start, clock)
      : `${on(start, clock)}\u2013${on(end, clock)}`;

  const cityName =
    locale === 'ar' ? (event.cityNameAr ?? event.cityName) : event.cityName;
  const seats =
    event.capacity === 0
      ? rsvp_no_limit({}, { locale })
      : event.remaining != null && event.remaining > 0
        ? chairs_left({ n: event.remaining }, { locale })
        : rsvp_event_full({}, { locale });

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
      {event.citySlug && (
        <Link
          to="/$market/$city"
          params={{ market: market.slug, city: event.citySlug }}
          className="mb-4 inline-flex min-h-6 items-center text-body-sm font-medium underline decoration-secondary underline-offset-[3px] hover:text-accent"
        >
          {back_to_city({ city: cityName }, { locale })}
        </Link>
      )}

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
              <dd className="mt-1.5 font-medium">
                {day} · <span dir="ltr">{times}</span>
              </dd>
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
                {role_host({}, { locale })} · {cityName}
              </span>
            </span>
            <Link
              to="/u/$userId"
              params={{ userId: host.id }}
              className="btn btn-outline btn-sm h-9 min-h-9 px-4"
            >
              {profile_link({}, { locale })}
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
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              {event.isFree ? (
                <p className="font-display text-h4 font-semibold">
                  {event_free({}, { locale })}
                </p>
              ) : null}
              <span className="ms-auto inline-flex h-[1.375rem] items-center gap-1.5 rounded-full bg-secondary-tint px-2.5 text-caption font-medium text-accent">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-secondary"
                />
                {seats}
              </span>
            </div>
            <RsvpSection event={event} hostName={host.name} locale={locale} />
          </div>
        </aside>
      </div>

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
    </article>
  );
};
