import { createDb, events, seed, user } from '@founders-coffee/db';
import { LOCALES } from '@founders-coffee/core/locale';
import {
  city_empty_title,
  cityInputs,
  footer_tagline,
} from '@founders-coffee/i18n';
import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import worker from '../src/server';

const PRODUCTION_ORIGIN = 'https://founders.coffee';
const productionEnv = {
  ...env,
  APP_ENVIRONMENT: 'production',
  APP_URL: PRODUCTION_ORIGIN,
};

const fetchDocument = async (
  origin: string,
  pathname: string,
  requestEnv: typeof env = env,
): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${origin}${pathname}`, {
      headers: { accept: 'text/html' },
    }),
    requestEnv,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

const jsonLd = (body: string): Record<string, unknown>[] =>
  [
    ...body.matchAll(
      /<script\b(?=[^>]*\btype=["']application\/ld\+json["'])[^>]*>([\s\S]*?)<\/script>/giu,
    ),
  ].map((match) => JSON.parse(match[1]) as Record<string, unknown>);

const headingLevels = (body: string): string[] =>
  [...body.matchAll(/<h([1-6])\b/giu)].map((match) => match[1]);

const firstHeading = (body: string): string =>
  (/<h1\b[^>]*>([\s\S]*?)<\/h1>/iu.exec(body)?.[1] ?? '')
    .replaceAll(/<[^>]+>/gu, '')
    .trim();

const sectionHeadings = (body: string): string[] =>
  [...body.matchAll(/<h2\b[^>]*>([\s\S]*?)<\/h2>/giu)].map((match) =>
    match[1].replaceAll(/<[^>]+>/gu, '').trim(),
  );

/**
 * The shell footer, which is the last one in the document — every event card renders a `<footer>`
 * of its own, so taking the first match reads a card instead of the page chrome.
 */
const shellFooter = (body: string): string =>
  [...body.matchAll(/<footer\b[^>]*>([\s\S]*?)<\/footer>/giu)].at(-1)?.[1] ??
  '';

const eventRows = LOCALES.map((locale) => ({
  id: `evt_geo05_${locale}`,
  title: `GEO-05 ${locale} meetup`,
  description: `A public GEO-05 ${locale} meetup for founders and builders.`,
  language: locale,
  slug: `geo-05-${locale}-meetup`,
}));

describe('public GEO contract', () => {
  beforeAll(async () => {
    const db = createDb(env.DB);
    await seed(db);
    await db
      .insert(user)
      .values({
        id: 'usr_geo05',
        name: 'GEO-05 Host',
        email: 'geo05@test.coffee',
        role: 'host',
      })
      .onConflictDoNothing()
      .run();
    for (const event of eventRows) {
      await db
        .insert(events)
        .values({
          ...event,
          hostId: 'usr_geo05',
          marketCode: 'DZ',
          stateCode: '16',
          cityCode: '556',
          venue: 'Café des Délices',
          startsAt: new Date(
            `2099-02-${15 + LOCALES.indexOf(event.language)}T18:00:00Z`,
          ),
          status: 'published',
        })
        .onConflictDoNothing()
        .run();
    }
  });

  it('keeps primary JSON-LD, visible headings, and canonical content aligned', async () => {
    for (const locale of LOCALES) {
      const event = eventRows.find((row) => row.language === locale);
      const pages = [
        {
          type: 'market',
          path: `/${locale}/algeria`,
          canonical: `${PRODUCTION_ORIGIN}/${locale}/algeria`,
          schemaType: 'CollectionPage',
          visibleText: { ar: 'الجزائر', fr: 'Algérie', en: 'Algeria' }[locale],
        },
        {
          type: 'city',
          path: `/${locale}/algeria/algiers`,
          canonical: `${PRODUCTION_ORIGIN}/${locale}/algeria/algiers`,
          schemaType: 'CollectionPage',
          visibleText: { ar: 'الجزائر العاصمة', fr: 'Alger', en: 'Algiers' }[
            locale
          ],
        },
        {
          type: 'event',
          path: `/${locale}/algeria/e/${event?.slug}`,
          canonical: `${PRODUCTION_ORIGIN}/${locale}/algeria/e/${event?.slug}`,
          schemaType: 'Event',
          visibleText: event?.title ?? '',
        },
        {
          type: 'company',
          path: `/${locale}/about`,
          canonical: `${PRODUCTION_ORIGIN}/${locale}/about`,
          schemaType: 'WebPage',
          visibleText:
            locale === 'ar'
              ? 'من نحن'
              : locale === 'fr'
                ? 'À propos de Founders Coffee'
                : 'About Founders Coffee',
        },
      ];

      for (const page of pages) {
        const response = await fetchDocument(
          PRODUCTION_ORIGIN,
          page.path,
          productionEnv,
        );
        const body = await response.text();
        const schemas = jsonLd(body);
        const primary = schemas.find(
          (schema) => schema['@type'] === page.schemaType,
        );
        const headings = headingLevels(body);
        expect(response.status, page.path).toBe(200);
        expect(response.headers.get('x-robots-tag'), page.path).toBeNull();
        expect(body, page.path).toContain(`<html lang="${locale}"`);
        expect(body, page.path).toContain(page.visibleText);
        expect(headings[0], page.path).toBe('1');
        expect(
          headings.filter((level) => level === '1'),
          page.path,
        ).toHaveLength(1);
        expect(headings.includes('2'), page.path).toBe(true);
        expect(
          schemas.filter((schema) => schema['@type'] === page.schemaType),
          page.path,
        ).toHaveLength(1);
        expect(primary?.url, page.path).toBe(page.canonical);
        expect(primary?.inLanguage, page.path).toBe(locale);
        expect(JSON.stringify(primary), page.path).not.toMatch(
          /(?:email|phone|hostId|rsvps)/iu,
        );
        if (page.type === 'event') {
          expect(primary?.name, page.path).toBe(event?.title);
          expect(primary?.organizer, page.path).toMatchObject({
            name: 'GEO-05 Host',
          });
          expect(body, page.path).toContain('GEO-05 Host');
        }
      }
    }
  });

  it('heads the city page with the name that language calls the city', async () => {
    const expected = { ar: 'الجزائر العاصمة', fr: 'Alger', en: 'Algiers' };

    for (const locale of LOCALES) {
      const response = await fetchDocument(
        PRODUCTION_ORIGIN,
        `/${locale}/algeria/algiers`,
        productionEnv,
      );

      expect(
        firstHeading(await response.text()),
        `the ${locale} city page is headed in another language (FC-28)`,
      ).toBe(expected[locale]);
    }
  });

  it('heads a city with nothing on by its name, and invites a host in a section beneath it', async () => {
    const oran = { ar: 'وهران', fr: 'Oran', en: 'Oran' };

    for (const locale of LOCALES) {
      const path = `/${locale}/algeria/oran`;
      const response = await fetchDocument(
        PRODUCTION_ORIGIN,
        path,
        productionEnv,
      );
      const body = await response.text();
      const headings = headingLevels(body);

      expect(response.status, path).toBe(200);
      expect(
        firstHeading(body),
        `${path} is headed by its invitation, where a city with meetups is headed by its name`,
      ).toBe(oran[locale]);
      expect(headings[0], path).toBe('1');
      expect(
        headings.filter((level) => level === '1'),
        path,
      ).toHaveLength(1);
      expect(
        sectionHeadings(body),
        `${path} has no h2 of its own; the GEO smoke refuses the page, and the footer no longer lends it three`,
      ).toContain(city_empty_title(cityInputs(oran[locale]), { locale }));
    }
  });

  it('tells the reader which market they are in, in the footer', async () => {
    const marketPages = [
      { slug: 'algeria', en: 'Algeria', fr: 'Algérie' },
      { slug: 'egypt', en: 'Egypt', fr: 'Égypte' },
      { slug: 'saudi-arabia', en: 'Saudi Arabia', fr: 'Arabie saoudite' },
    ] as const;

    for (const market of marketPages) {
      for (const locale of ['en', 'fr'] as const) {
        const response = await fetchDocument(
          PRODUCTION_ORIGIN,
          `/${locale}/${market.slug}`,
          productionEnv,
        );

        expect(
          shellFooter(await response.text()),
          `the footer of /${locale}/${market.slug} invites the reader to meet founders in a country they are not browsing`,
        ).toContain(footer_tagline({ market: market[locale] }, { locale }));
      }
    }
  });

  it('keeps staging discovery documents empty and noindexed', async () => {
    const response = await fetchDocument(
      'https://staging.founders.coffee',
      '/fr/algeria',
    );
    const body = await response.text();
    expect(response.status).toBe(200);
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
    expect(body).toContain('https://staging.founders.coffee/fr/algeria');
    expect(body).not.toContain(PRODUCTION_ORIGIN);
  });
});
