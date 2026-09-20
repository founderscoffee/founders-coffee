import { describe, expect, it } from 'vitest';

import { LOCALES, type Locale } from '@founders-coffee/i18n';

import {
  localizedCity,
  localizedCloseout,
  localizedEvent,
  localizedFeedback,
  localizedHome,
  localizedHostCreate,
  localizedLanding,
} from './locale-routing';
import { canonicalPath } from './seo';
import { sitemapCompanyItems } from './sitemap-contract';

type RouteTarget = {
  readonly to: string;
  readonly params?: Readonly<Record<string, string>>;
};

const resolve = ({ to, params }: RouteTarget): string =>
  to.replace(/\$(\w+)/gu, (_, name: string) => params?.[name] ?? '');

describe('the link template and the crawler template address the same page', () => {
  it.each(LOCALES)('agrees on a market landing in %s', (locale: Locale) => {
    expect(
      resolve(localizedLanding(locale, 'algeria')),
      'a reader clicking through and a crawler reading the canonical must land on one URL, or the canonical names a page no link points at',
    ).toBe(canonicalPath({ type: 'market', market: 'algeria', locale }));
  });

  it.each(LOCALES)('agrees on a city page in %s', (locale: Locale) => {
    expect(resolve(localizedCity(locale, 'algeria', 'algiers'))).toBe(
      canonicalPath({
        type: 'city',
        market: 'algeria',
        city: 'algiers',
        locale,
      }),
    );
  });

  it.each(LOCALES)('agrees on an event page in %s', (locale: Locale) => {
    expect(resolve(localizedEvent(locale, 'algeria', 'coffee-code'))).toBe(
      canonicalPath({
        type: 'event',
        market: 'algeria',
        slug: 'coffee-code',
        locale,
      }),
    );
  });

  it.each(LOCALES)('agrees on a company page in %s', (locale: Locale) => {
    expect(resolve(localizedLanding(locale, 'terms'))).toBe(
      canonicalPath({ type: 'company', path: '/terms', locale }),
    );
  });

  it('reaches every company URL the sitemap advertises', () => {
    const linkable = new Set(
      LOCALES.flatMap((locale) =>
        ['terms', 'privacy', 'cookies', 'community', 'organizers', 'legal'].map(
          (key) => resolve(localizedLanding(locale, key)),
        ),
      ),
    );

    for (const { path } of sitemapCompanyItems().filter(({ path }) =>
      /\/(terms|privacy|cookies|community|organizers|legal)$/u.test(path),
    ))
      expect(
        linkable.has(path),
        `the sitemap advertises ${path} but no link template produces it`,
      ).toBe(true);
  });
});

describe('the template never addresses a redirect stub', () => {
  it.each(LOCALES)('prefixes every destination in %s', (locale: Locale) => {
    const targets = [
      localizedLanding(locale, 'algeria'),
      localizedCity(locale, 'algeria', 'algiers'),
      localizedEvent(locale, 'algeria', 'coffee-code'),
      localizedHostCreate(locale, 'algeria'),
      localizedHome(locale, 'algeria'),
      localizedCloseout(locale, 'evt_1'),
      localizedFeedback(locale, 'evt_1'),
    ];

    for (const target of targets)
      expect(
        resolve(target).startsWith(`/${locale}/`),
        'an unprefixed path answers 307 to its prefixed form before it renders anything',
      ).toBe(true);
  });

  it('falls back to the root redirect only when no market can be named', () => {
    expect(resolve(localizedHome('ar', undefined))).toBe('/');
    expect(resolve(localizedHome('ar', 'algeria'))).toBe('/ar/algeria');
  });
});
