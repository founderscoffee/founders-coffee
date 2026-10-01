import { describe, expect, it } from 'vitest';

import { runWithContext } from '@founders-coffee/observability/context';

import { eventPageHead } from './seo-event';

const SEARCH_EVENT = {
  locale: 'fr',
  marketCode: 'DZ',
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
    endsAt: new Date('2026-09-20T12:00:00Z'),
    createdAt: new Date('2026-09-01T08:30:00Z'),
    timezone: 'Africa/Algiers',
    status: 'published',
    venue: 'Café Atlas',
    cityName: 'Alger',
    regionName: 'Alger',
    venueAddress: null,
    latitude: null,
    longitude: null,
    marketCode: 'DZ',
    languages: ['fr'],
    url: 'https://founders.coffee/fr/algeria/e/cafe',
    currency: 'DZD',
    organizer: null,
  },
  breadcrumbs: [],
} as const;

const searchHead = (over: Partial<Parameters<typeof eventPageHead>[0]> = {}) =>
  runWithContext({ siteOrigin: 'https://founders.coffee' }, () =>
    eventPageHead({ ...SEARCH_EVENT, ...over }),
  );

const content = (head: ReturnType<typeof searchHead>, key: string) =>
  head.meta.find(
    (item) =>
      ('property' in item && item.property === key) ||
      ('name' in item && item.name === key),
  )?.content;

const documentTitle = (head: ReturnType<typeof searchHead>) =>
  head.meta.find((item) => 'title' in item)?.title;

const structuredEvent = (head: ReturnType<typeof searchHead>) =>
  JSON.parse(head.scripts[0]?.children ?? '{}');

const SUMMARY =
  'Le dimanche 20 septembre à 11:00 · Café Atlas, Alger. Rencontre Founders Coffee gratuite.';

describe('event page metadata', () => {
  it('leads the search result with the meetup and its city, and names the brand after them', () => {
    expect(documentTitle(searchHead())).toBe(
      'Café fondateurs · Alger - Founders Coffee',
    );
  });

  it('cuts a long title at a word rather than through one', () => {
    const title =
      'Petit-déjeuner des fondateurs qui construisent des produits pour les commerçants algériens';
    const shown = documentTitle(searchHead({ title })) ?? '';

    expect(Array.from(shown).length).toBeLessThanOrEqual(70);
    expect(shown.endsWith('…')).toBe(true);
    expect(title.startsWith(shown.slice(0, -1))).toBe(true);
    expect(title.charAt(shown.length - 1)).toBe(' ');
  });

  it('shares the meetup under its own name, which og:site_name already brands', () => {
    const head = searchHead();

    expect(content(head, 'og:title')).toBe('Café fondateurs');
    expect(content(head, 'twitter:title')).toBe('Café fondateurs');
    expect(content(head, 'og:site_name')).toBe('Founders Coffee');
  });

  it('declares a type Open Graph defines', () => {
    expect(searchHead().meta).toContainEqual({
      property: 'og:type',
      content: 'website',
    });
  });

  it('says when and where before anything the host wrote', () => {
    const head = searchHead();

    expect(content(head, 'description')).toBe(SUMMARY);
    expect(content(head, 'og:description')).toBe(SUMMARY);
    expect(content(head, 'twitter:description')).toBe(SUMMARY);
  });

  it("follows with the host's words and cuts them at a word", () => {
    const description =
      'Un café entre fondateurs pour parler produit, clients et recrutement. Venez comme vous êtes, sans présentation à préparer, et repartez avec des contacts utiles.';
    const shown = content(searchHead({ description }), 'description') ?? '';

    expect(shown.startsWith(`${SUMMARY} Un café entre fondateurs`)).toBe(true);
    expect(Array.from(shown).length).toBeLessThanOrEqual(160);
    expect(shown.endsWith('…')).toBe(true);
    expect(`${SUMMARY} ${description}`.charAt(shown.length - 1)).toBe(' ');
  });

  it('says a cancelled meetup is cancelled before it says when it was', () => {
    const head = searchHead({
      structuredEvent: { ...SEARCH_EVENT.structuredEvent, status: 'cancelled' },
    });

    expect(content(head, 'description')).toBe(
      'Annulée. Elle était prévue le dimanche 20 septembre à 11:00 · Café Atlas, Alger.',
    );
  });

  it('says the date in the market timezone, in the language of the page', () => {
    expect(
      content(searchHead({ locale: 'en', cityName: 'Algiers' }), 'description'),
    ).toBe(
      'Sunday, September 20 at 11:00 · Café Atlas, Algiers. A free Founders Coffee meetup.',
    );
    expect(
      content(
        searchHead({
          locale: 'ar',
          cityName: 'الجزائر العاصمة',
          description: 'قهوة وحديث بين المؤسسين.',
          structuredEvent: {
            ...SEARCH_EVENT.structuredEvent,
            venue: 'مقهى الأطلس',
          },
        }),
        'description',
      ),
    ).toBe(
      'الأحد، 20 سبتمبر الساعة 11:00 · مقهى الأطلس، الجزائر العاصمة. لقاء مجاني تنظّمه Founders Coffee. قهوة وحديث بين المؤسسين.',
    );
  });

  it("describes the meetup in its structured data in the host's words", () => {
    const description = 'Un café entre fondateurs.';

    expect(structuredEvent(searchHead({ description }))).toMatchObject({
      '@type': 'Event',
      description,
      image:
        'https://founders.coffee/og/e/cafe0000000000000000000000000f?l=fr&v=3',
    });
  });

  it('falls back to localized copy where the host wrote nothing', () => {
    expect(structuredEvent(searchHead()).description).toContain('Rejoignez');
  });

  it('adds the breadcrumb trail after the event', () => {
    const head = searchHead();

    expect(head.scripts).toHaveLength(2);
    expect(JSON.parse(head.scripts[1]?.children ?? '{}')).toMatchObject({
      '@type': 'BreadcrumbList',
    });
  });
});

const CARD_EVENT = {
  locale: 'ar',
  marketCode: 'DZ',
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
    createdAt: new Date('2026-09-01T08:30:00Z'),
    timezone: 'Africa/Algiers',
    status: 'published',
    venue: 'مقهى',
    cityName: 'الجزائر العاصمة',
    regionName: 'الجزائر',
    venueAddress: null,
    latitude: null,
    longitude: null,
    marketCode: 'DZ',
    languages: ['ar'],
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

  it("names the meetup's own country in its locale, not Algeria's for every page", () => {
    expect(tag(cardHead(), 'og:locale')).toBe('ar_DZ');
    expect(tag(cardHead({ marketCode: 'EG' }), 'og:locale')).toBe('ar_EG');
    expect(tag(cardHead({ locale: 'fr', marketCode: 'SA' }), 'og:locale')).toBe(
      'fr_SA',
    );
  });
});
