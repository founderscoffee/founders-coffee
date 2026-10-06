import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { EventEditDraft } from './event-edit-draft';
import {
  clearEventEditDraft,
  readEventEditDraft,
  writeEventEditDraft,
} from './event-edit-storage';

const edited: EventEditDraft = {
  title: 'Founders breakfast, second edition',
  description: 'A local founder meetup worth showing up to, again.',
  venueName: 'Café Atlas',
  venue: {
    providerId: 'event:evt_1',
    kind: 'address',
    name: 'Café Atlas',
    address: '',
    latitude: 36.7538,
    longitude: 3.0588,
  },
  venueSearch: 'atl',
  startsAt: Date.parse('2099-09-20T10:00:00Z'),
  endsAt: Date.parse('2099-09-20T12:00:00Z'),
  languages: ['ar', 'fr'],
};

beforeEach(() => window.sessionStorage.clear());

afterEach(() => vi.useRealTimers());

describe('the edits a host has not saved', () => {
  it('come back for the meetup and version they were made on', () => {
    writeEventEditDraft('evt_1', 3, edited);

    expect(
      readEventEditDraft('evt_1', 3),
      'the form makes a pin with an empty address from a row that has none, which a venue schema refuses',
    ).toEqual(edited);
    expect(readEventEditDraft('evt_2', 3)).toBeNull();
  });

  it('are dropped once the meetup has moved to another version', () => {
    writeEventEditDraft('evt_1', 3, edited);

    expect(readEventEditDraft('evt_1', 4)).toBeNull();
    expect(window.sessionStorage.getItem('fc:event-edit:evt_1')).toBeNull();
  });

  it('are dropped after a day', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.parse('2026-10-05T08:00:00Z'));
    writeEventEditDraft('evt_1', 3, edited);

    vi.setSystemTime(Date.parse('2026-10-06T08:00:01Z'));

    expect(readEventEditDraft('evt_1', 3)).toBeNull();
  });

  it('are dropped when they cannot be read', () => {
    window.sessionStorage.setItem(
      'fc:event-edit:evt_1',
      JSON.stringify({ version: 1, eventId: 'evt_1', title: 42 }),
    );

    expect(readEventEditDraft('evt_1', 3)).toBeNull();
    expect(window.sessionStorage.getItem('fc:event-edit:evt_1')).toBeNull();
  });

  it('are gone once cleared', () => {
    writeEventEditDraft('evt_1', 3, edited);
    clearEventEditDraft('evt_1');

    expect(readEventEditDraft('evt_1', 3)).toBeNull();
  });
});
