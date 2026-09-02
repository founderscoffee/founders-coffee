import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  firstInvalidField,
  focusInvalidField,
  restoredDraftStep,
  validateDetailsStep,
  validateScheduleStep,
  validateVenueStep,
} from './host-create-validation';
import type { HostCreateDraft } from './host-create-draft';

const startsAt = new Date('2099-01-15T18:00:00Z').getTime();
const validDraft: HostCreateDraft = {
  step: 4,
  venue: {
    providerId: 'poi-cafe',
    name: 'Founders Café',
    address: '12 Startup Street, Algiers',
    latitude: 36.7538,
    longitude: 3.0588,
  },
  searchValue: 'Founders Café',
  startsAt,
  endsAt: startsAt + 60 * 60_000,
  title: 'Founder meetup',
  description: 'A complete founder meetup description.',
  capacity: 0,
  language: 'ar',
  category: 'coffee-meetup',
};

describe('host create validation', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('validates the shared schema projection for every step', () => {
    expect(validateVenueStep(validDraft.venue, 'en')).toEqual({});
    expect(
      validateScheduleStep(validDraft.startsAt, validDraft.endsAt, 'en'),
    ).toEqual({});
    expect(
      validateDetailsStep(
        {
          title: validDraft.title,
          description: validDraft.description,
          capacity: validDraft.capacity,
          language: validDraft.language,
          category: validDraft.category,
        },
        'en',
      ),
    ).toEqual({});
  });

  it('restores to the first step whose saved projection is invalid', () => {
    expect(restoredDraftStep(validDraft, 'en')).toBe(4);
    expect(restoredDraftStep({ ...validDraft, venue: null }, 'en')).toBe(1);
    expect(
      restoredDraftStep({ ...validDraft, endsAt: startsAt + 1 }, 'en'),
    ).toBe(2);
    expect(restoredDraftStep({ ...validDraft, title: '' }, 'en')).toBe(3);
  });

  it('focuses and scrolls the first invalid field', () => {
    const input = document.createElement('input');
    input.id = 'host-title';
    input.scrollIntoView = vi.fn();
    document.body.appendChild(input);
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });

    const errors = validateDetailsStep(
      {
        title: '',
        description: '',
        capacity: 0,
        language: 'ar',
        category: 'coffee-meetup',
      },
      'en',
    );
    expect(firstInvalidField(errors)).toBe('title');
    focusInvalidField('title');
    expect(document.activeElement).toBe(input);
    expect(input.scrollIntoView).toHaveBeenCalledOnce();
  });
});
