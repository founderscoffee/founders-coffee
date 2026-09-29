export type JsonLdObject = Record<string, unknown>;

export type StructuredListItem = {
  readonly name: string;
  readonly url: string;
};

import type { EventStatus } from '@founders-coffee/core';
import { zonedIsoString } from '@founders-coffee/i18n';

export type StructuredEventData = {
  readonly title: string;
  readonly description: string;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly createdAt: Date;
  readonly timezone: string;
  readonly status: EventStatus;
  readonly venue: string;
  readonly cityName: string;
  readonly regionName: string | null;
  readonly venueAddress: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly marketCode: string;
  readonly languages: readonly string[];
  readonly url: string;
  readonly image?: string;
  readonly currency: string;
  readonly organizer: { readonly name: string; readonly url: string } | null;
};

export const itemListJsonLd = (
  items: readonly StructuredListItem[],
): JsonLdObject => ({
  '@type': 'ItemList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    url: item.url,
  })),
});

export const collectionPageJsonLd = (input: {
  readonly name: string;
  readonly description: string;
  readonly url: string;
  readonly locale: string;
  readonly items: readonly StructuredListItem[];
}): JsonLdObject => ({
  '@context': 'https://schema.org',
  '@type': 'CollectionPage',
  name: input.name,
  description: input.description,
  url: input.url,
  inLanguage: input.locale,
  mainEntity: itemListJsonLd(input.items),
});

export const breadcrumbJsonLd = (
  items: readonly StructuredListItem[],
): JsonLdObject => ({
  '@context': 'https://schema.org',
  '@type': 'BreadcrumbList',
  itemListElement: items.map((item, index) => ({
    '@type': 'ListItem',
    position: index + 1,
    name: item.name,
    item: item.url,
  })),
});

/**
 * The schema.org `Event` for a meetup page, shaped the way Google's event documentation asks.
 *
 * The free `Offer` stands for the seat the page offers, so it is there only while RSVPs are open:
 * for a published meetup whose start is still ahead, the same `starts_at` rule the server applies
 * when it refuses an RSVP. It is valid from the meetup's publication, when RSVPs opened. A meetup
 * that has started or ended keeps `EventScheduled`, which is true of one that took place.
 *
 * Times are the market's wall-clock time with its offset, the form Google recommends, rather than
 * UTC. The address is always there, because Google requires one: a meetup stored without a street
 * address still has its city, region and country, which is what Google asks for when there is no
 * street to give.
 */
export const eventJsonLd = (
  event: StructuredEventData,
  now: number = Date.now(),
): JsonLdObject => {
  const localTime = (date: Date): string =>
    zonedIsoString(date.getTime(), event.timezone);
  const location: JsonLdObject = {
    '@type': 'Place',
    name: event.venue,
    address: {
      '@type': 'PostalAddress',
      ...(event.venueAddress ? { streetAddress: event.venueAddress } : {}),
      addressLocality: event.cityName,
      ...(event.regionName ? { addressRegion: event.regionName } : {}),
      addressCountry: event.marketCode,
    },
    ...(event.latitude !== null && event.longitude !== null
      ? {
          geo: {
            '@type': 'GeoCoordinates',
            latitude: event.latitude,
            longitude: event.longitude,
          },
        }
      : {}),
  };

  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description,
    url: event.url,
    ...(event.image ? { image: event.image } : {}),
    startDate: localTime(event.startsAt),
    ...(event.endsAt ? { endDate: localTime(event.endsAt) } : {}),
    eventStatus:
      event.status === 'cancelled'
        ? 'https://schema.org/EventCancelled'
        : 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    inLanguage:
      event.languages.length === 1 ? event.languages[0] : event.languages,
    isAccessibleForFree: true,
    location,
    ...(event.status === 'published' && event.startsAt.getTime() > now
      ? {
          offers: {
            '@type': 'Offer',
            price: 0,
            priceCurrency: event.currency,
            availability: 'https://schema.org/InStock',
            url: event.url,
            validFrom: localTime(event.createdAt),
          },
        }
      : {}),
    ...(event.organizer
      ? {
          organizer: {
            '@type': 'Person',
            name: event.organizer.name,
            url: event.organizer.url,
          },
        }
      : {}),
  };
};
