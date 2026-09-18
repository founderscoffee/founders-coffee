import { describe, expect, it } from 'vitest';

import { inspectGeoDocument } from './geo-contract.mjs';

const document = ({ type, name, locale = 'en', url }) => `
  <html lang="${locale}">
    <head>
      <script type="application/ld+json">${JSON.stringify({
        '@context': 'https://schema.org',
        '@type': type,
        name,
        url,
        inLanguage: locale,
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
