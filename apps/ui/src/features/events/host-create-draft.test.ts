import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearHostCreateDraft,
  readHostCreateDraft,
  writeHostCreateDraft,
  type HostCreateDraft,
} from './host-create-draft';
import { VENUE_SEARCH_MAX_LENGTH } from './types';

const draft: HostCreateDraft = {
  step: 4,
  venue: {
    providerId: 'poi-cafe',
    name: 'Founders Café',
    address: '12 Startup Street, Algiers',
    latitude: 36.7538,
    longitude: 3.0588,
  },
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

  it('round-trips the complete draft within its market and city', () => {
    writeHostCreateDraft('DZ', '556', draft);
    expect(readHostCreateDraft('DZ', '556')).toEqual(draft);
    expect(readHostCreateDraft('DZ', '557')).toBeNull();
  });

  it('rejects malformed persisted state', () => {
    window.sessionStorage.setItem(
      'fc:event-draft:DZ:556',
      JSON.stringify({
        ...draft,
        version: 1,
        savedAt: Date.now(),
        capacity: -1,
      }),
    );
    expect(readHostCreateDraft('DZ', '556')).toBeNull();
    expect(window.sessionStorage.getItem('fc:event-draft:DZ:556')).toBeNull();
  });

  it('clears persisted state after successful publication', () => {
    writeHostCreateDraft('DZ', '556', draft);
    clearHostCreateDraft('DZ', '556');
    expect(readHostCreateDraft('DZ', '556')).toBeNull();
  });
});

describe('AR: a draft this module wrote is always readable', () => {
  const base = {
    step: 3,
    venue: {
      providerId: 'poi-cafe',
      name: 'Founders Café',
      address: '12 Startup Street, Algiers',
      latitude: 36.7538,
      longitude: 3.0588,
    },
    startsAt: new Date('2099-01-15T18:00:00Z').getTime(),
    endsAt: new Date('2099-01-15T19:00:00Z').getTime(),
    title: 'Protected meetup',
    description: 'A complete protected meetup for founders.',
    capacity: 0,
    language: 'en' as const,
    category: 'coffee-meetup' as const,
  };

  it('survives a venue search value longer than the schema allows', () => {
    writeHostCreateDraft('DZ', '1', {
      ...base,
      searchValue: 'x'.repeat(VENUE_SEARCH_MAX_LENGTH + 200),
    });

    const restored = readHostCreateDraft('DZ', '1');

    expect(restored).not.toBeNull();
    expect(restored?.title).toBe(base.title);
    expect(restored?.venue?.name).toBe('Founders Café');
    expect(restored?.searchValue.length).toBe(VENUE_SEARCH_MAX_LENGTH);
  });

  it('still discards a draft it did not write', () => {
    window.sessionStorage.setItem(
      'fc:event-draft:DZ:1',
      JSON.stringify({ version: 1, savedAt: Date.now(), tampered: true }),
    );
    expect(readHostCreateDraft('DZ', '1')).toBeNull();
  });
});
