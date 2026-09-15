import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { createdEventQueryKeys } from './created-event-cache';

const CREATED = {
  marketCode: 'DZ',
  cityCode: '1',
  hostId: 'usr_host01',
  slug: 'protected-meetup',
};

const CACHED_QUERIES: Record<string, readonly unknown[]> = {
  upcomingFeed: ['events', 'upcoming', { marketCode: 'DZ', cityCode: '1' }],
  upcomingGlobalFeed: ['events', 'upcoming', {}],
  eventDetail: ['event', 'protected-meetup'],
  marketLanding: ['markets', 'landing', 'DZ'],
  cityLanding: ['markets', 'city', 'DZ', '1'],
  hostProfile: ['profile', 'public', 'usr_host01'],
  otherEvent: ['event', 'someone-elses-meetup'],
  otherMarket: ['markets', 'landing', 'EG'],
  otherCity: ['markets', 'city', 'DZ', '31'],
  otherProfile: ['profile', 'public', 'usr_other'],
  visibleMarkets: ['markets', 'visible'],
  myProfile: ['profile', 'me'],
  hostMap: ['events', 'host-map', { marketCode: 'DZ', cityCode: '1' }],
  venueSearch: ['events', 'venue-search', { query: 'cafe' }],
};

const INVALIDATED = [
  'upcomingFeed',
  'upcomingGlobalFeed',
  'eventDetail',
  'marketLanding',
  'cityLanding',
  'hostProfile',
];

const invalidatedNames = (): string[] => {
  const client = new QueryClient();
  for (const key of Object.values(CACHED_QUERIES)) {
    client.setQueryData(key, { cached: true });
  }
  for (const queryKey of createdEventQueryKeys(CREATED)) {
    void client.invalidateQueries({ queryKey });
  }
  return Object.entries(CACHED_QUERIES)
    .filter(([, key]) => client.getQueryState(key)?.isInvalidated)
    .map(([name]) => name);
};

describe('createdEventQueryKeys', () => {
  it('invalidates exactly the cached views the new event appears in', () => {
    expect(invalidatedNames().sort()).toEqual([...INVALIDATED].sort());
  });

  it('leaves the billed Mapbox caches under the events root untouched', () => {
    const invalidated = invalidatedNames();
    expect(invalidated).not.toContain('hostMap');
    expect(invalidated).not.toContain('venueSearch');
  });
});
