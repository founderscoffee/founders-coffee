import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { EVENT_LANGUAGES, inspectGeoDocument } from './geo-contract.mjs';

const document = ({ type, name, locale = 'en', url, inLanguage = locale }) => `
  <html lang="${locale}">
    <head>
      <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': type,
        name,
        url,
        inLanguage,
      })}</script>
    </head>
    <body><h1>${name}</h1><h2>Details</h2></body>
  </html>
`;

const withAlternates = (body, locales, path) =>
  body.replace(
    '<head>',
    `<head>${locales
      .map(
        (locale) =>
          `<link rel="alternate" hrefLang="${locale}" href="https://founders.coffee/${locale}${path}"/>`,
      )
      .join('')}`,
  );

describe('GEO document contract', () => {
  it('accepts a localized canonical primary entity with visible headings', () => {
    expect(
      inspectGeoDocument({
        path: '/fr/algeria',
        type: 'market',
        body: document({
          type: 'CollectionPage',
          name: 'Algeria',
          locale: 'fr',
          url: 'https://founders.coffee/fr/algeria',
        }),
        canonical: 'https://founders.coffee/fr/algeria',
      }),
    ).toEqual([]);
  });

  it('rejects duplicate entities and private fields in the primary schema', () => {
    const body = `${document({
      type: 'Event',
      name: 'Meetup',
      url: 'https://founders.coffee/en/algeria/e/meetup',
    })}${document({
      type: 'Event',
      name: 'Meetup',
      url: 'https://founders.coffee/en/algeria/e/meetup',
    })}`.replace('"inLanguage":"en"', '"inLanguage":"en","hostId":"internal"');
    const failures = inspectGeoDocument({
      path: '/en/algeria/e/meetup',
      type: 'event',
      body,
      canonical: 'https://founders.coffee/en/algeria/e/meetup',
    });
    expect(failures).toContain('contains duplicate Event JSON-LD entities');
    expect(failures).toContain('primary JSON-LD contains private fields');
  });

  it('does not confuse private-looking words in authored copy with fields', () => {
    expect(
      inspectGeoDocument({
        path: '/en/algeria/e/phone-founders',
        type: 'event',
        body: document({
          type: 'Event',
          name: 'Phone founders meetup',
          url: 'https://founders.coffee/en/algeria/e/phone-founders',
        }),
        canonical: 'https://founders.coffee/en/algeria/e/phone-founders',
      }),
    ).toEqual([]);
  });

  it('reads a document published in one language only as that language', () => {
    expect(
      inspectGeoDocument({
        path: '/fr/terms',
        type: 'company',
        body: withAlternates(
          document({
            type: 'WebPage',
            name: 'Terms',
            locale: 'ar',
            url: 'https://founders.coffee/ar/terms',
          }),
          ['ar'],
          '/terms',
        ),
        canonical: 'https://founders.coffee/ar/terms',
      }),
    ).toEqual([]);
  });

  it('still wants a translated document to speak the language of its own URL', () => {
    expect(
      inspectGeoDocument({
        path: '/fr/about',
        type: 'company',
        body: withAlternates(
          document({
            type: 'WebPage',
            name: 'About',
            locale: 'ar',
            url: 'https://founders.coffee/ar/about',
          }),
          ['ar', 'fr', 'en'],
          '/about',
        ),
        canonical: 'https://founders.coffee/ar/about',
      }),
    ).toContain('WebPage JSON-LD inLanguage does not match the route');
  });
});

const MEETUP = 'https://founders.coffee/en/algeria/e/meetup';
const UNSUPPORTED = 'Event JSON-LD has no supported inLanguage';

const meetupHeldIn = (inLanguage) =>
  inspectGeoDocument({
    path: '/en/algeria/e/meetup',
    type: 'event',
    body: document({ type: 'Event', name: 'Meetup', url: MEETUP, inLanguage }),
    canonical: MEETUP,
  });

describe('the languages a meetup is held in', () => {
  it('accepts one language, whether or not the site is written in it', () => {
    expect(meetupHeldIn('fr')).toEqual([]);
    expect(meetupHeldIn('ber')).toEqual([]);
  });

  it('accepts several, named together in a list', () => {
    expect(meetupHeldIn(['fr', 'ber'])).toEqual([]);
  });

  it('rejects a list that names no language', () => {
    expect(meetupHeldIn([])).toEqual([UNSUPPORTED]);
  });

  it('rejects a language no meetup can be held in, alone or in a list', () => {
    expect(meetupHeldIn('it')).toEqual([UNSUPPORTED]);
    expect(meetupHeldIn(['fr', 'it'])).toEqual([UNSUPPORTED]);
  });

  it('rejects a language named twice', () => {
    expect(meetupHeldIn(['fr', 'fr'])).toEqual([UNSUPPORTED]);
  });

  it('still wants any other page in one of the site languages, as its route has it', () => {
    const market = (inLanguage) =>
      inspectGeoDocument({
        path: '/fr/algeria',
        type: 'market',
        body: document({
          type: 'CollectionPage',
          name: 'Algeria',
          locale: 'fr',
          url: 'https://founders.coffee/fr/algeria',
          inLanguage,
        }),
        canonical: 'https://founders.coffee/fr/algeria',
      });
    for (const inLanguage of [['fr'], 'ber'])
      expect(market(inLanguage)).toEqual([
        'CollectionPage JSON-LD has no supported inLanguage',
        'CollectionPage JSON-LD inLanguage does not match the route',
      ]);
  });
});

const DOMAIN = join(
  dirname(fileURLToPath(import.meta.url)),
  '../../libs/domain/src',
);

/**
 * The codes a meetup's languages may take, read out of the schema that validates them.
 *
 * Read from the source rather than imported, for the reason `routes.test.mjs` gives about the
 * company pages. `eventLanguagesSchema` is a list of `spokenLanguageSchema`, the enum over
 * `SPOKEN_LANGUAGES`; when either link is rewritten this reads nothing, rather than a list the
 * schema no longer draws on.
 */
const schemaLanguages = () => {
  const events = readFileSync(join(DOMAIN, 'events/languages.ts'), 'utf8');
  const profile = readFileSync(join(DOMAIN, 'profile/schemas.ts'), 'utf8');
  if (
    !/eventLanguagesSchema = z\s*\.array\(spokenLanguageSchema\)/u.test(
      events,
    ) ||
    !profile.includes('spokenLanguageSchema = z.enum(SPOKEN_LANGUAGES)')
  )
    return [];
  const list = profile.match(/SPOKEN_LANGUAGES = \[([^\]]*)\]/u)?.[1] ?? '';
  return [...list.matchAll(/'([^']+)'/gu)].map((match) => match[1]);
};

describe('the languages the smoke lets a meetup be held in', () => {
  it('finds the schema it is comparing against', () => {
    expect(schemaLanguages().length).toBeGreaterThan(3);
  });

  it('are the ones the meetup schema accepts, and no others', () => {
    expect([...EVENT_LANGUAGES].sort()).toEqual(schemaLanguages().sort());
  });
});
