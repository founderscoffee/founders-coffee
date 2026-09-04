import { describe, expect, it } from 'vitest';

import type { EventFeedItem } from '@founders-coffee/server-fns';

import { applyCityFilters, type CityFilterKey } from './city-filters';

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
    category: 'coffee-meetup',
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
    expect(ids(feed, ['fr'], now)).toEqual(['fr']);
  });

  it('combines active chips with AND', () => {
    const feed = [
      event('ar-workshop', '2026-09-11T10:00:00Z', {
        language: 'ar',
        category: 'workshop',
      }),
      event('ar-coffee', '2026-09-11T10:00:00Z', { language: 'ar' }),
      event('fr-workshop', '2026-09-11T10:00:00Z', {
        language: 'fr',
        category: 'workshop',
      }),
    ];
    expect(ids(feed, ['ar', 'workshop'], now)).toEqual(['ar-workshop']);
    expect(ids(feed, ['ar', 'fr'], now)).toEqual([]);
  });
});
