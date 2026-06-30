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
  event_where,
  formatDate,
  type Locale,
} from '@founders-coffee/i18n';
import type { Market } from '@founders-coffee/db';
import type { EventWithAttendance, PublicProfile } from '@founders-coffee/server-fns';

import { RsvpSection } from './RsvpSection';

type EventDetailProps = {
  locale: Locale;
  market: Market;
  event: EventWithAttendance;
  host: PublicProfile;
};

/** Compact, locale-independent language code(s) for the language badge (e.g. `AR + FR`). */
const LANGUAGE_LABEL: Record<EventWithAttendance['language'], string> = {
  ar: 'AR',
  en: 'EN',
  fr: 'FR',
  ar_en: 'AR + EN',
  ar_fr: 'AR + FR',
};

const categoryLabel = (category: EventWithAttendance['category'], locale: Locale): string =>
  category === 'coffee-meetup'
    ? cat_coffee_meetup({}, { locale })
    : category === 'workshop'
      ? cat_workshop({}, { locale })
      : cat_demo_day({}, { locale });

export const EventDetail = ({ locale, market, event, host }: EventDetailProps) => {
  const when = formatDate(event.startsAt, locale, {
    timeZone: market.timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: '2-digit',
    minute: '2-digit',
  });
  const capacityText =
    event.capacity === 0 ? event_no_cap({}, { locale }) : `${event_capacity({}, { locale })}: ${event.capacity}`;

  return (
    <article className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex flex-wrap gap-2">
        <span className="badge badge-outline badge-primary">{categoryLabel(event.category, locale)}</span>
        <span className="badge badge-ghost">{LANGUAGE_LABEL[event.language]}</span>
        {event.isFree ? <span className="badge badge-secondary">{event_free({}, { locale })}</span> : null}
      </div>

      <h1 className="mt-4 text-3xl font-extrabold leading-tight">{event.title}</h1>

      <dl className="mt-6 space-y-3">
        <div className="flex flex-wrap gap-2">
          <dt className="text-xs font-bold uppercase tracking-widest text-base-content/40">{event_when({}, { locale })}</dt>
          <dd>{when}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="text-xs font-bold uppercase tracking-widest text-base-content/40">{event_where({}, { locale })}</dt>
          <dd>
            {event.venue}
            {event.venueAddress ? <span className="text-base-content/60"> — {event.venueAddress}</span> : null}
            {event.latitude != null && event.longitude != null ? (
              <span className="text-base-content/40">
                {' '}📍 {event.latitude.toFixed(4)}, {event.longitude.toFixed(4)}
              </span>
            ) : null}
          </dd>
        </div>
      </dl>

      <div className="mt-6">
        <RsvpSection event={event} locale={locale} />
      </div>

      {event.description ? (
        <p className="mt-6 whitespace-pre-line leading-relaxed text-base-content/80">{event.description}</p>
      ) : null}

      <div className="mt-8 flex items-center gap-3 border-t border-base-300 pt-6">
        <span className="text-xs font-bold uppercase tracking-widest text-base-content/40">
          {event_host({}, { locale })}
        </span>
        <Link to="/u/$userId" params={{ userId: host.id }} className="link link-hover font-semibold">
          {host.name}
        </Link>
      </div>

      <p className="mt-4 text-xs text-base-content/40">{capacityText}</p>
    </article>
  );
};
