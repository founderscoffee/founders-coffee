import { createDb, events, seed, user } from '@founders-coffee/db';
import { LOCALES } from '@founders-coffee/core/locale';
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
          visibleText: locale === 'ar' ? 'الجزائر' : 'Algeria',
        },
        {
          type: 'city',
          path: `/${locale}/algeria/algiers`,
          canonical: `${PRODUCTION_ORIGIN}/${locale}/algeria/algiers`,
          schemaType: 'CollectionPage',
          visibleText: locale === 'ar' ? 'الجزائر' : 'Algiers',
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
              ? 'عن founders.coffee'
              : locale === 'fr'
                ? 'À propos de founders.coffee'
                : 'About founders.coffee',
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
