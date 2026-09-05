import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearHostCreateDraft,
  readHostCreateDraft,
  writeHostCreateDraft,
  type HostCreateDraft,
} from './host-create-draft';
import { VENUE_SEARCH_MAX_LENGTH } from './types';

const draft: HostCreateDraft = {
  step: 3,
  venue: {
    providerId: 'poi-cafe',
    kind: 'poi' as const,
    name: 'Founders Café',
    address: '12 Startup Street, Algiers',
    latitude: 36.7538,
    longitude: 3.0588,
  },
  venueName: 'Founders Café',
  searchValue: 'Founders Café',
  startsAt: new Date('2099-01-15T18:00:00Z').getTime(),
  endsAt: new Date('2099-01-15T19:00:00Z').getTime(),
  title: 'Founder meetup',
  description: 'A complete founder meetup description.',
  capacity: 24,
  language: 'fr',
  category: 'workshop',
};

describe('host create draft', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('round-trips the complete draft within its market', () => {
    writeHostCreateDraft('DZ', draft);
    expect(readHostCreateDraft('DZ')).toEqual(draft);
    expect(readHostCreateDraft('EG')).toBeNull();
  });

  it('rejects malformed persisted state', () => {
    window.sessionStorage.setItem(
      'fc:event-draft:DZ',
      JSON.stringify({
        ...draft,
        version: 1,
        savedAt: Date.now(),
        capacity: -1,
      }),
    );
    expect(readHostCreateDraft('DZ')).toBeNull();
    expect(window.sessionStorage.getItem('fc:event-draft:DZ')).toBeNull();
  });

  it('clears persisted state after successful publication', () => {
    writeHostCreateDraft('DZ', draft);
    clearHostCreateDraft('DZ');
    expect(readHostCreateDraft('DZ')).toBeNull();
  });
});

describe('AR: a draft this module wrote is always readable', () => {
  const base = {
    step: 3,
    venue: {
      providerId: 'poi-cafe',
      kind: 'poi' as const,
      name: 'Founders Café',
      address: '12 Startup Street, Algiers',
      latitude: 36.7538,
      longitude: 3.0588,
    },
    venueName: 'Founders Café',
    startsAt: new Date('2099-01-15T18:00:00Z').getTime(),
    endsAt: new Date('2099-01-15T19:00:00Z').getTime(),
    title: 'Protected meetup',
    description: 'A complete protected meetup for founders.',
    capacity: 0,
    language: 'en' as const,
    category: 'coffee-meetup' as const,
  };

  it('survives a venue search value longer than the schema allows', () => {
    writeHostCreateDraft('DZ', {
      ...base,
      searchValue: 'x'.repeat(VENUE_SEARCH_MAX_LENGTH + 200),
    });

    const restored = readHostCreateDraft('DZ');

    expect(restored).not.toBeNull();
    expect(restored?.title).toBe(base.title);
    expect(restored?.venue?.name).toBe('Founders Café');
    expect(restored?.searchValue.length).toBe(VENUE_SEARCH_MAX_LENGTH);
  });

  it('still discards a draft it did not write', () => {
    window.sessionStorage.setItem(
      'fc:event-draft:DZ',
      JSON.stringify({ version: 1, savedAt: Date.now(), tampered: true }),
    );
    expect(readHostCreateDraft('DZ')).toBeNull();
  });
});
