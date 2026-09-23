import { describe, expect, it } from 'vitest';

import type { EventFeedItem } from '@founders-coffee/server-fns';

import { LOCALES } from '@founders-coffee/i18n';

import {
  applyCityFilters,
  CITY_FILTER_KEYS,
  type CityFilterKey,
} from './city-filters';

const ALGIERS = 'Africa/Algiers';

const event = (
  id: string,
  startsAt: string,
  extra: Partial<EventFeedItem> = {},
): EventFeedItem =>
  ({
    id,
    startsAt: new Date(startsAt),
    language: 'en',
    ...extra,
  }) as EventFeedItem;

const ids = (
  events: readonly EventFeedItem[],
  active: readonly CityFilterKey[],
  now: Date,
) => applyCityFilters(events, active, ALGIERS, now).map((entry) => entry.id);

describe('applyCityFilters', () => {
  const now = new Date('2026-09-09T09:00:00Z');

  it('returns the feed untouched when nothing is active', () => {
    const feed = [event('a', '2026-09-09T17:00:00Z')];
    expect(ids(feed, [], now)).toEqual(['a']);
  });

  it('reads "today" in the market timezone, not UTC', () => {
    const feed = [
      event('utc-8th-algiers-9th', '2026-09-08T23:30:00Z'),
      event('utc-9th-algiers-10th', '2026-09-09T23:30:00Z'),
    ];
    expect(ids(feed, ['today'], now)).toEqual(['utc-8th-algiers-9th']);
  });

  it('treats Friday and Saturday as the weekend', () => {
    const feed = [
      event('thu', '2026-09-10T10:00:00Z'),
      event('fri', '2026-09-11T10:00:00Z'),
      event('sat', '2026-09-12T10:00:00Z'),
      event('sun', '2026-09-13T10:00:00Z'),
    ];
    expect(ids(feed, ['weekend'], now)).toEqual(['fri', 'sat']);
  });

  it('matches a single language chip against the event language', () => {
    const feed = [
      event('en', '2026-09-11T10:00:00Z'),
      event('ar', '2026-09-11T10:00:00Z', { language: 'ar' }),
      event('fr', '2026-09-11T10:00:00Z', { language: 'fr' }),
    ];
    expect(ids(feed, ['ar'], now)).toEqual(['ar']);
    expect(ids(feed, ['en'], now)).toEqual(['en']);
    expect(ids(feed, ['fr'], now)).toEqual(['fr']);
  });

  it('offers a chip for every language the site is read in', () => {
    for (const locale of LOCALES) {
      expect(CITY_FILTER_KEYS).toContain(locale);
    }
    expect(CITY_FILTER_KEYS).toHaveLength(LOCALES.length + 2);
  });

  it('can find a meetup in any language a host could have created it in', () => {
    const feed = LOCALES.map((locale) =>
      event(locale, '2026-09-11T10:00:00Z', { language: locale }),
    );
    for (const locale of LOCALES) {
      expect(ids(feed, [locale], now)).toEqual([locale]);
    }
  });

  it('asks for both when a language chip meets a date chip', () => {
    const feed = [
      event('ar-today', '2026-09-09T10:00:00Z', { language: 'ar' }),
      event('ar-later', '2026-09-11T10:00:00Z', { language: 'ar' }),
      event('fr-today', '2026-09-09T10:00:00Z', { language: 'fr' }),
    ];
    expect(ids(feed, ['ar', 'today'], now)).toEqual(['ar-today']);
    expect(ids(feed, ['ar', 'fr', 'today'], now)).toEqual([
      'ar-today',
      'fr-today',
    ]);
  });

  it('asks for either when two language chips are on', () => {
    const feed = [
      event('ar', '2026-09-11T10:00:00Z', { language: 'ar' }),
      event('en', '2026-09-11T10:00:00Z', { language: 'en' }),
      event('fr', '2026-09-11T10:00:00Z', { language: 'fr' }),
    ];
    expect(ids(feed, ['ar', 'fr'], now)).toEqual(['ar', 'fr']);
    expect(ids(feed, ['ar', 'en'], now)).toEqual(['ar', 'en']);
    expect(ids(feed, ['en', 'fr'], now)).toEqual(['en', 'fr']);
  });

  it('shows everything when every language chip is on, as when none is', () => {
    const feed = LOCALES.map((locale) =>
      event(locale, '2026-09-11T10:00:00Z', { language: locale }),
    );
    expect(ids(feed, [...LOCALES], now)).toEqual(ids(feed, [], now));
  });

  it('still lands on nothing when the date chips disagree', () => {
    const feed = [
      event('ar-today', '2026-09-09T10:00:00Z', { language: 'ar' }),
    ];
    expect(ids(feed, ['today', 'weekend'], now)).toEqual([]);
  });
});
