import { describe, expect, it } from 'vitest';

import type { RepeatEventTemplate } from './api';
import { repeatDraftFrom } from './host-create-repeat';

const template: RepeatEventTemplate = {
  sourceEventId: 'evt_previous',
  marketCode: 'DZ',
  cityCode: '1',
  title: 'Founders breakfast',
  description: 'A relaxed breakfast for local founders.',
  venue: 'Café Atlas',
  venueAddress: '12 Rue des Entrepreneurs, Alger',
  latitude: 36.7538,
  longitude: 3.0588,
};

describe('repeatDraftFrom', () => {
  it('copies only safe editable values and clears the schedule', () => {
    expect(repeatDraftFrom(template)).toEqual({
      step: 1,
      venue: {
        providerId: 'repeat:evt_previous',
        kind: 'address',
        name: 'Café Atlas',
        address: '12 Rue des Entrepreneurs, Alger',
        latitude: 36.7538,
        longitude: 3.0588,
      },
      venueName: 'Café Atlas',
      searchValue: '',
      startsAt: null,
      endsAt: null,
      title: 'Founders breakfast',
      description: 'A relaxed breakfast for local founders.',
    });
  });

  it('leaves the venue empty when the source has no complete location', () => {
    expect(
      repeatDraftFrom({ ...template, venueAddress: null, latitude: null }),
    ).toMatchObject({ venue: null, venueName: '' });
  });
});
