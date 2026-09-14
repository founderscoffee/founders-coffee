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
});
