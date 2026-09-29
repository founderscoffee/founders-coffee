import { describe, expect, it } from 'vitest';

import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  eventJsonLd,
  type StructuredEventData,
} from './seo-structured-data';

const BREAKFAST: StructuredEventData = {
  title: 'Founders breakfast',
  description: 'A local meetup',
  startsAt: new Date('2026-09-20T10:00:00Z'),
  endsAt: new Date('2026-09-20T12:00:00Z'),
  createdAt: new Date('2026-09-01T08:30:00Z'),
  timezone: 'Africa/Algiers',
  status: 'published',
  venue: 'Café Atlas',
  cityName: 'Alger',
  regionName: 'Alger',
  venueAddress: '12 Rue des Entrepreneurs, Alger',
  latitude: 36.7538,
  longitude: 3.0588,
  marketCode: 'DZ',
  languages: ['fr'],
  url: 'https://founders.coffee/fr/algeria/e/founders-breakfast',
  currency: 'DZD',
  organizer: null,
};

describe('structured discovery data', () => {
  it('builds a collection page with ordered public event links', () => {
    const schema = collectionPageJsonLd({
      name: 'Algiers · Algeria',
      description: 'Meetups in Algiers',
      url: 'https://founders.coffee/en/algeria/algiers',
      locale: 'en',
      items: [
        {
          name: 'Founders breakfast',
          url: 'https://founders.coffee/en/algeria/e/founders-breakfast',
        },
      ],
    });

    expect(schema).toMatchObject({
      '@type': 'CollectionPage',
      inLanguage: 'en',
      mainEntity: {
        '@type': 'ItemList',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Founders breakfast',
          },
        ],
      },
    });
  });

  it('publishes complete free event data and hides offers for cancellations', () => {
    const event: StructuredEventData = {
      ...BREAKFAST,
      image: 'https://founders.coffee/social/event.webp',
      organizer: {
        name: 'Amina',
        url: 'https://founders.coffee/u/usr_123',
      },
    };
    const beforeStart = event.startsAt.getTime() - 1;
    const published = eventJsonLd(event, beforeStart);
    const cancelled = eventJsonLd(
      {
        ...event,
        status: 'cancelled',
      },
      beforeStart,
    );

    expect(published).toMatchObject({
      '@type': 'Event',
      image: 'https://founders.coffee/social/event.webp',
      startDate: '2026-09-20T11:00:00+01:00',
      endDate: '2026-09-20T13:00:00+01:00',
      eventStatus: 'https://schema.org/EventScheduled',
      inLanguage: 'fr',
      isAccessibleForFree: true,
      location: {
        '@type': 'Place',
        name: 'Café Atlas',
        address: {
          '@type': 'PostalAddress',
          streetAddress: '12 Rue des Entrepreneurs, Alger',
          addressLocality: 'Alger',
          addressRegion: 'Alger',
          addressCountry: 'DZ',
        },
        geo: { latitude: 36.7538, longitude: 3.0588 },
      },
      offers: {
        price: 0,
        priceCurrency: 'DZD',
        availability: 'https://schema.org/InStock',
        validFrom: '2026-09-01T09:30:00+01:00',
      },
      organizer: { '@type': 'Person', name: 'Amina' },
    });
    expect(cancelled).toMatchObject({
      eventStatus: 'https://schema.org/EventCancelled',
      startDate: '2026-09-20T11:00:00+01:00',
    });
    expect(cancelled).not.toHaveProperty('offers');
  });

  it('writes its times on the market’s own clock, with that clock’s offset', () => {
    expect(
      eventJsonLd({ ...BREAKFAST, timezone: 'Africa/Cairo' }, 0),
      'Google asks for the local hour with its offset; UTC names the same moment but not the hour the meetup is announced at',
    ).toMatchObject({
      startDate: '2026-09-20T13:00:00+03:00',
      endDate: '2026-09-20T15:00:00+03:00',
    });
  });

  it('gives the city as the address of a meetup stored without a street address', () => {
    const schema = eventJsonLd({ ...BREAKFAST, venueAddress: null }, 0);

    expect(
      schema.location,
      'Google requires location.address and asks for the city where no street address is known; leaving the address out made such a meetup an invalid item',
    ).toEqual({
      '@type': 'Place',
      name: 'Café Atlas',
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Alger',
        addressRegion: 'Alger',
        addressCountry: 'DZ',
      },
      geo: {
        '@type': 'GeoCoordinates',
        latitude: 36.7538,
        longitude: 3.0588,
      },
    });
  });

  it('leaves the region out when the dataset no longer knows it', () => {
    const schema = eventJsonLd({ ...BREAKFAST, regionName: null }, 0);

    expect(schema.location).toMatchObject({
      address: { addressLocality: 'Alger', addressCountry: 'DZ' },
    });
    expect(
      (schema.location as { address: Record<string, unknown> }).address,
    ).not.toHaveProperty('addressRegion');
  });

  it('withdraws the offer once the meetup has started, and keeps it scheduled', () => {
    const event: StructuredEventData = {
      ...BREAKFAST,
      venueAddress: null,
      latitude: null,
      longitude: null,
    };
    const start = event.startsAt.getTime();

    expect(eventJsonLd(event, start - 1)).toHaveProperty('offers');
    for (const now of [start, start + 3 * 60 * 60 * 1000]) {
      const schema = eventJsonLd(event, now);
      expect(
        schema,
        'an InStock offer on a meetup nobody can join any more is the page advertising a seat the server refuses',
      ).not.toHaveProperty('offers');
      expect(schema).toMatchObject({
        eventStatus: 'https://schema.org/EventScheduled',
      });
    }
  });

  it('names every language a meetup is held in', () => {
    expect(
      eventJsonLd({ ...BREAKFAST, languages: ['ar', 'fr'] }, 0),
    ).toMatchObject({ inLanguage: ['ar', 'fr'] });
  });

  it('builds breadcrumb positions without private profile data', () => {
    const schema = breadcrumbJsonLd([
      { name: 'Founders Coffee', url: 'https://founders.coffee/en' },
      { name: 'Algeria', url: 'https://founders.coffee/en/algeria' },
    ]);

    expect(schema).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, name: 'Founders Coffee' },
        { position: 2, name: 'Algeria' },
      ],
    });
    expect(JSON.stringify(schema)).not.toContain('email');
  });
});
