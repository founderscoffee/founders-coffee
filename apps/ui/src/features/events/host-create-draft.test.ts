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
  chosenLanguages: ['ar', 'fr'],
};

describe('host create draft', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('round-trips the complete draft within its market', () => {
    writeHostCreateDraft('DZ', draft);
    expect(readHostCreateDraft('DZ')).toEqual(draft);
    expect(readHostCreateDraft('EG')).toBeNull();
  });

  it('keeps no languages until the host chooses some, so the page language can stand in', () => {
    writeHostCreateDraft('DZ', { ...draft, chosenLanguages: null });
    expect(readHostCreateDraft('DZ')?.chosenLanguages).toBeNull();
  });

  it('keeps a choice of none, rather than losing the whole draft over it', () => {
    writeHostCreateDraft('DZ', { ...draft, chosenLanguages: [] });
    expect(readHostCreateDraft('DZ')?.chosenLanguages).toEqual([]);
  });

  it('restores a draft saved before a meetup could have several languages', () => {
    window.sessionStorage.setItem(
      'fc:event-draft:DZ',
      JSON.stringify({
        version: 5,
        savedAt: Date.now(),
        marketCode: 'DZ',
        ...draft,
        chosenLanguages: undefined,
        language: 'en',
      }),
    );
    expect(
      readHostCreateDraft('DZ'),
      'a host half way through a meetup when this shipped would have lost it, title and all',
    ).toEqual({ ...draft, chosenLanguages: null });
  });

  it('drops a draft naming a language nobody can choose', () => {
    window.sessionStorage.setItem(
      'fc:event-draft:DZ',
      JSON.stringify({
        version: 5,
        savedAt: Date.now(),
        marketCode: 'DZ',
        ...draft,
        chosenLanguages: ['xx'],
      }),
    );
    expect(readHostCreateDraft('DZ')).toBeNull();
  });

  it('rejects malformed persisted state', () => {
    window.sessionStorage.setItem(
      'fc:event-draft:DZ',
      JSON.stringify({
        ...draft,
        version: 1,
        savedAt: Date.now(),
        title: 42,
      }),
    );
    expect(readHostCreateDraft('DZ')).toBeNull();
    expect(window.sessionStorage.getItem('fc:event-draft:DZ')).toBeNull();
  });

  it('keeps a repeat’s draft for that repeat, and for a plain wizard', () => {
    writeHostCreateDraft('DZ', draft, 'evt_previous');

    expect(readHostCreateDraft('DZ', 'evt_previous')).toEqual(draft);
    expect(readHostCreateDraft('DZ', 'evt_other')).toBeNull();
    expect(readHostCreateDraft('DZ')).toEqual(draft);
  });

  it('leaves a plain draft out of a repeat', () => {
    writeHostCreateDraft('DZ', draft);

    expect(readHostCreateDraft('DZ', 'evt_previous')).toBeNull();
    expect(readHostCreateDraft('DZ')).toEqual(draft);
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
    chosenLanguages: null,
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

  it('survives a repeat id longer than the schema allows, as a plain draft', () => {
    writeHostCreateDraft(
      'DZ',
      { ...base, searchValue: '' },
      `evt_${'x'.repeat(80)}`,
    );

    expect(readHostCreateDraft('DZ')?.title).toBe(base.title);
  });

  it('still discards a draft it did not write', () => {
    window.sessionStorage.setItem(
      'fc:event-draft:DZ',
      JSON.stringify({ version: 1, savedAt: Date.now(), tampered: true }),
    );
    expect(readHostCreateDraft('DZ')).toBeNull();
  });
});
