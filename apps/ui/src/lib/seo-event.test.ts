import { describe, expect, it } from 'vitest';

import { runWithContext } from '@founders-coffee/observability/context';

import { eventPageHead } from './seo-event';

describe('event page metadata', () => {
  it('falls back to localized event copy and truncates authored descriptions by code points', () => {
    const head = runWithContext({ siteOrigin: 'https://founders.coffee' }, () =>
      eventPageHead({
        locale: 'fr',
        eventId: 'evt_cafe0000000000000000000000000f',
        version: 3,
        title: 'Café fondateurs',
        cityName: 'Alger',
        description: '😀'.repeat(200),
        route: {
          type: 'event',
          market: 'algeria',
          slug: 'cafe',
          locale: 'fr',
        },
        structuredEvent: {
          title: 'Café fondateurs',
          description: '😀'.repeat(200),
          startsAt: new Date('2026-09-20T10:00:00Z'),
          endsAt: new Date('2026-09-20T12:00:00Z'),
          status: 'published',
          venue: 'Café',
          cityName: 'Alger',
          venueAddress: null,
          latitude: null,
          longitude: null,
          marketCode: 'DZ',
          language: 'fr',
          url: 'https://founders.coffee/fr/algeria/e/cafe',
          currency: 'DZD',
          organizer: null,
        },
        breadcrumbs: [],
      }),
    );
    const fallback = eventPageHead({
      locale: 'fr',
      eventId: 'evt_cafe0000000000000000000000000f',
      version: 3,
      title: 'Café fondateurs',
      cityName: 'Alger',
      description: '',
      route: { type: 'event', market: 'algeria', slug: 'cafe', locale: 'fr' },
      structuredEvent: {
        title: 'Café fondateurs',
        description: '',
        startsAt: new Date('2026-09-20T10:00:00Z'),
        endsAt: null,
        status: 'published',
        venue: 'Café',
        cityName: 'Alger',
        venueAddress: null,
        latitude: null,
        longitude: null,
        marketCode: 'DZ',
        language: 'fr',
        url: 'https://founders.coffee/fr/algeria/e/cafe',
        currency: 'DZD',
        organizer: null,
      },
      breadcrumbs: [],
    });
    const description = head.meta.find(
      (item) => item.name === 'description',
    )?.content;

    expect(Array.from(description ?? '')).toHaveLength(160);
    expect(description?.endsWith('…')).toBe(true);
    expect(
      fallback.meta.find((item) => item.name === 'description')?.content,
    ).toContain('Rejoignez');
    expect(head.meta).toContainEqual({ property: 'og:type', content: 'event' });
    expect(JSON.parse(head.scripts[0]?.children ?? '{}')).toMatchObject({
      '@type': 'Event',
      description,
      image:
        'https://founders.coffee/og/e/cafe0000000000000000000000000f?l=fr&v=3',
    });
    expect(head.scripts).toHaveLength(2);
    expect(JSON.parse(head.scripts[1]?.children ?? '{}')).toMatchObject({
      '@type': 'BreadcrumbList',
    });
  });
});

const CARD_EVENT = {
  locale: 'ar',
  eventId: 'evt_cafe0000000000000000000000000f',
  version: 3,
  title: 'لقاء قهوة للمؤسسين',
  cityName: 'الجزائر العاصمة',
  route: {
    type: 'event',
    market: 'algeria',
    slug: 'cafe',
    locale: 'ar',
  },
  structuredEvent: {
    title: 'لقاء قهوة للمؤسسين',
    description: 'وصف',
    startsAt: new Date('2026-09-20T10:00:00Z'),
    endsAt: null,
    status: 'published',
    venue: 'مقهى',
    cityName: 'الجزائر العاصمة',
    venueAddress: null,
    latitude: null,
    longitude: null,
    marketCode: 'DZ',
    language: 'ar',
    url: 'https://founders.coffee/ar/algeria/e/cafe',
    currency: 'DZD',
    organizer: null,
  },
  breadcrumbs: [],
} as const;

const cardHead = (over: Partial<Parameters<typeof eventPageHead>[0]> = {}) =>
  runWithContext({ siteOrigin: 'https://founders.coffee' }, () =>
    eventPageHead({ ...CARD_EVENT, ...over }),
  );

const tag = (head: ReturnType<typeof cardHead>, key: string) =>
  head.meta.find(
    (item) =>
      ('property' in item && item.property === key) ||
      ('name' in item && item.name === key),
  )?.content;

describe('the card a shared meetup previews as', () => {
  it('points every scraper at this meetup, not at the house picture', () => {
    const head = cardHead();
    const card =
      'https://founders.coffee/og/e/cafe0000000000000000000000000f?l=ar&v=3';
    expect(tag(head, 'og:image')).toBe(card);
    expect(tag(head, 'twitter:image')).toBe(card);
    expect(tag(head, 'og:image:width')).toBe('1200');
    expect(tag(head, 'og:image:height')).toBe('630');
  });

  it('asks for the wide card, which is the shape the picture is drawn in', () => {
    expect(tag(cardHead(), 'twitter:card')).toBe('summary_large_image');
  });

  it('describes what the picture says, rather than what the site is', () => {
    expect(tag(cardHead(), 'og:image:alt')).toBe(
      'لقاء قهوة للمؤسسين · الجزائر العاصمة',
    );
  });

  it('gives an edited meetup a new address, so a stale card is not kept', () => {
    expect(tag(cardHead({ version: 4 }), 'og:image')).not.toBe(
      tag(cardHead({ version: 3 }), 'og:image'),
    );
  });

  it('asks for the card in the language the page is read in', () => {
    expect(tag(cardHead({ locale: 'fr' }), 'og:image')).toContain('l=fr');
  });
});
