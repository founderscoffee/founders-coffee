import { describe, expect, it } from 'vitest';

import {
  breadcrumbJsonLd,
  collectionPageJsonLd,
  eventJsonLd,
  type StructuredEventData,
} from './seo-structured-data';

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
      title: 'Founders breakfast',
      description: 'A local meetup',
      startsAt: new Date('2026-09-20T10:00:00Z'),
      endsAt: new Date('2026-09-20T12:00:00Z'),
      status: 'published',
      venue: 'Café Atlas',
      cityName: 'Alger',
      venueAddress: '12 Rue des Entrepreneurs, Alger',
      latitude: 36.7538,
      longitude: 3.0588,
      marketCode: 'DZ',
      language: 'fr',
      url: 'https://founders.coffee/fr/algeria/e/founders-breakfast',
      currency: 'DZD',
      organizer: {
        name: 'Amina',
        url: 'https://founders.coffee/u/usr_123',
      },
    };
    const published = eventJsonLd(event);
    const cancelled = eventJsonLd({
      ...event,
      status: 'cancelled',
    });

    expect(published).toMatchObject({
      '@type': 'Event',
      startDate: '2026-09-20T10:00:00.000Z',
      endDate: '2026-09-20T12:00:00.000Z',
      eventStatus: 'https://schema.org/EventScheduled',
      isAccessibleForFree: true,
      location: {
        '@type': 'Place',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'Alger',
          addressCountry: 'DZ',
        },
        geo: { latitude: 36.7538, longitude: 3.0588 },
      },
      offers: {
        price: 0,
        priceCurrency: 'DZD',
      },
      organizer: { '@type': 'Person', name: 'Amina' },
    });
    expect(cancelled).toMatchObject({
      eventStatus: 'https://schema.org/EventCancelled',
    });
    expect(cancelled).not.toHaveProperty('offers');
  });

  it('builds breadcrumb positions without private profile data', () => {
    const schema = breadcrumbJsonLd([
      { name: 'founders.coffee', url: 'https://founders.coffee/en' },
      { name: 'Algeria', url: 'https://founders.coffee/en/algeria' },
    ]);

    expect(schema).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { position: 1, name: 'founders.coffee' },
        { position: 2, name: 'Algeria' },
      ],
    });
    expect(JSON.stringify(schema)).not.toContain('email');
  });
});
