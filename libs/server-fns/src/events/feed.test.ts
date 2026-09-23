import { describe, expect, it } from 'vitest';

import type { Event } from '@founders-coffee/db';

import { attachCityNames } from './feed.js';

const meetupIn = (cityCode: string) =>
  ({
    id: 'evt_feed',
    hostId: 'usr_feed',
    marketCode: 'DZ',
    stateCode: '16',
    cityCode,
  }) as unknown as Event;

describe('attachCityNames', () => {
  it('names the city of every meetup in each language a reader can pick', () => {
    const [meetup] = attachCityNames([meetupIn('556')]);

    expect(
      meetup,
      'a French page listed its meetups under Algiers, the English name, beside a city page titled Alger',
    ).toMatchObject({
      cityName: 'Algiers',
      cityNameAr: 'الجزائر العاصمة',
      cityNameFr: 'Alger',
      citySlug: 'algiers',
    });
  });

  it('writes the Latin name in French for a city French does not rename', () => {
    const [meetup] = attachCityNames([meetupIn('1131')]);

    expect(meetup).toMatchObject({ cityName: 'Oran', cityNameFr: 'Oran' });
  });
});
