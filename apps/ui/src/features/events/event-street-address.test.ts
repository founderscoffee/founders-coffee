import { describe, expect, it } from 'vitest';

import { eventStreetAddress } from './event-street-address';

const sharmElSheikh = {
  cityName: 'Sharm El-Shaikh',
  cityNameAr: 'شرم الشيخ',
  cityNameFr: 'Charm el-Cheikh',
  stateName: 'South Sinai',
  stateNameAr: 'جنوب سيناء',
  stateNameFr: 'Sinaï du Sud',
};

describe('the street address a meetup page gives search engines', () => {
  it('is the stored address when it names a street', () => {
    expect(
      eventStreetAddress({
        ...sharmElSheikh,
        venueAddress: 'El Salam Road, Naama Bay',
      }),
    ).toBe('El Salam Road, Naama Bay');
  });

  it.each(Object.values(sharmElSheikh))(
    'is none when the stored address is only a name of the city or its region: %s',
    (venueAddress) => {
      expect(
        eventStreetAddress({ ...sharmElSheikh, venueAddress }),
        'Google gives "Sydney" as the address not to use; the city is already the locality',
      ).toBeNull();
    },
  );

  it('matches a place name whatever its case and surrounding spaces', () => {
    expect(
      eventStreetAddress({
        ...sharmElSheikh,
        venueAddress: '  charm EL-cheikh ',
      }),
    ).toBeNull();
  });

  it('still recognises the city when the region is unknown', () => {
    expect(
      eventStreetAddress({
        ...sharmElSheikh,
        stateName: null,
        stateNameAr: null,
        stateNameFr: null,
        venueAddress: 'Sharm El-Shaikh',
      }),
    ).toBeNull();
  });

  it('is none when nothing was stored', () => {
    expect(
      eventStreetAddress({ ...sharmElSheikh, venueAddress: null }),
    ).toBeNull();
  });
});
