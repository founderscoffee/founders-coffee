import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  firstInvalidField,
  focusInvalidField,
  restoredDraftStep,
  shownErrors,
  validateDetailsStep,
  validateScheduleStep,
  validateVenueStep,
} from './host-create-validation';
import type { HostCreateDraft } from './host-create-draft';

const startsAt = new Date('2099-01-15T18:00:00Z').getTime();
const cafe = {
  providerId: 'poi-cafe',
  kind: 'poi' as const,
  name: 'Founders Café',
  address: '12 Startup Street, Algiers',
  latitude: 36.7538,
  longitude: 3.0588,
};
const validDraft: HostCreateDraft = {
  step: 3,
  venue: cafe,
  venueName: 'Founders Café',
  searchValue: 'Founders Café',
  startsAt,
  endsAt: startsAt + 60 * 60_000,
  title: 'Founder meetup',
  description: 'A complete founder meetup description.',
  chosenLanguages: null,
};

describe('host create validation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('validates the shared schema projection for every step', () => {
    expect(
      validateVenueStep(validDraft.venue, validDraft.venueName, 'en'),
    ).toEqual({});
    expect(
      validateScheduleStep(validDraft.startsAt, validDraft.endsAt, 'en'),
    ).toEqual({});
    expect(
      validateDetailsStep(
        {
          title: validDraft.title,
          description: validDraft.description,
          languages: ['ar'],
        },
        'en',
      ),
    ).toEqual({});
  });

  it('restores to the first step whose saved projection is invalid', () => {
    expect(restoredDraftStep(validDraft, 'en')).toBe(3);
    expect(restoredDraftStep({ ...validDraft, venue: null }, 'en')).toBe(1);
    expect(
      restoredDraftStep({ ...validDraft, endsAt: startsAt + 1 }, 'en'),
    ).toBe(2);
  });

  it('tells a gap from a value that will not do, on every step', () => {
    const street = {
      ...cafe,
      providerId: 'address-yousfi',
      kind: 'address' as const,
    };
    expect(validateVenueStep(null, '', 'en')).toEqual({ venue: null });
    expect(validateVenueStep(street, '  ', 'en')).toEqual({ venueName: null });
    expect(validateVenueStep(street, 'K', 'en')).toEqual({
      venueName: 'Name the venue so attendees can find the entrance.',
    });
    expect(
      validateVenueStep({ ...cafe, name: 'K' }, 'K', 'en'),
      'a place the meetup cannot use is no gap the host can fill',
    ).toEqual({ venue: 'Choose a supported venue to continue.' });
    expect(validateScheduleStep(null, null, 'en')).toEqual({ schedule: null });
    expect(validateScheduleStep(startsAt, startsAt + 1, 'en')).toEqual({
      schedule: 'The meetup duration must be between 30 and 480 minutes.',
    });
    expect(
      validateDetailsStep({ title: ' ', description: '', languages: [] }, 'en'),
    ).toEqual({ title: null, description: null, languages: null });
    expect(
      validateDetailsStep(
        { title: 'x', description: validDraft.description, languages: ['ar'] },
        'en',
      ),
    ).toEqual({ title: 'The title must be between 3 and 120 characters.' });
  });

  it('shows what a check says about a value given, and nothing new about a gap', () => {
    const picker = 'That time does not exist in this time zone.';

    expect(
      shownErrors({ schedule: null }, { schedule: picker }),
      'the time picker’s own word on the time the host chose stays',
    ).toEqual({ schedule: picker });
    expect(
      shownErrors(
        { title: null, description: 'Too short.' },
        { languages: 'Earlier.' },
      ),
    ).toEqual({ description: 'Too short.' });
    expect(firstInvalidField({ title: null, description: 'Too short.' })).toBe(
      'title',
    );
    expect(firstInvalidField({})).toBeNull();
  });

  it('takes the host to the first field holding the step back, marked and in view', () => {
    const input = document.createElement('input');
    input.id = 'host-title';
    input.scrollIntoView = vi.fn();
    document.body.appendChild(input);

    focusInvalidField('title');

    expect(document.activeElement).toBe(input);
    expect(input.hasAttribute('data-sought')).toBe(true);
    expect(
      input.scrollIntoView,
      'centring a field already in view scrolled the page under the host',
    ).toHaveBeenCalledWith({ behavior: 'smooth', block: 'nearest' });
    input.blur();
    expect(
      input.hasAttribute('data-sought'),
      'the ring has to leave with the focus',
    ).toBe(false);
  });

  it('takes the host to the calendar’s day, not to the arrows above it', () => {
    const calendar = document.createElement('div');
    calendar.id = 'host-calendar';
    calendar.innerHTML =
      '<button type="button">Previous month</button>' +
      '<button type="button" tabindex="-1">2</button>' +
      '<button type="button" tabindex="0">3</button>';
    document.body.appendChild(calendar);

    focusInvalidField('schedule');

    expect(document.activeElement?.textContent).toBe('3');
  });

  it('takes the host to the chips once every language has been taken off', () => {
    const group = document.createElement('div');
    group.id = 'host-languages';
    group.tabIndex = -1;
    document.body.appendChild(group);

    focusInvalidField('languages');

    expect(document.activeElement).toBe(group);
  });

  it('leaves the venue to the page, which offers its places', () => {
    const search = document.createElement('input');
    search.id = 'venue-search';
    document.body.appendChild(search);

    focusInvalidField('venue');

    expect(document.activeElement).toBe(document.body);
  });
});
