import { describe, expect, it } from 'vitest';

import { lookupsFor, pickCity } from './city-lookup.mjs';

const SHARM = {
  code: '326',
  name: 'Sharm El-Shaikh',
  nameAr: 'شرم الشيخ',
  nameFr: 'Charm el-Cheikh',
  slug: 'sharm-el-shaikh',
  stateCode: '21',
  featured: true,
};

const ARISH = {
  code: '377',
  name: 'Arish',
  nameAr: 'العريش',
  nameFr: 'El-Arich',
  slug: 'arish',
  stateCode: '26',
  featured: true,
};

const feature = (
  name,
  { type = 'place', country = 'EG', point = [34.325, 27.909], span = 0.1 } = {},
) => ({
  type: 'Feature',
  geometry: { type: 'Point', coordinates: point },
  properties: {
    feature_type: type,
    name,
    bbox: [point[0] - span, point[1] - span, point[0] + span, point[1] + span],
    context: { country: { country_code: country } },
  },
});

describe('lookupsFor', () => {
  it('tries the name, the French and Arabic names, then the name with its article', () => {
    expect(lookupsFor(ARISH)).toEqual([
      { query: 'Arish', language: 'en' },
      { query: 'El-Arich', language: 'en' },
      { query: 'العريش', language: 'ar' },
      { query: 'Al Arish', language: 'en' },
    ]);
  });

  it('adds no article to a name that has one, and no French name that repeats it', () => {
    const elOued = {
      name: 'El Oued',
      nameFr: 'El Oued',
      nameAr: 'الوادي',
      slug: 'el-oued',
    };

    expect(lookupsFor(elOued)).toEqual([
      { query: 'El Oued', language: 'en' },
      { query: 'الوادي', language: 'ar' },
    ]);
  });
});

describe('pickCity', () => {
  it('refuses a place that does not carry the city’s name', () => {
    const kafrElSheikh = feature('Kafr El Sheikh', {
      type: 'locality',
      point: [31.311466, 30.621542],
    });

    expect(
      pickCity([kafrElSheikh], SHARM, 'EG'),
      'the first snapshot stored this Delta village as Sharm El Sheikh',
    ).toBeNull();
    expect(
      pickCity(
        [feature('Bahrah governorate', { country: 'SA' })],
        { name: 'Bahah', nameAr: 'الباحة', slug: 'bahah' },
        'SA',
      ),
      'the committed snapshot placed Al Bahah at Bahrah, near Jeddah',
    ).toBeNull();
  });

  it('refuses a place in another country, or one whose point is outside its bounds', () => {
    const outside = feature('شرم الشيخ');
    outside.properties.bbox = [0, 0, 1, 1];

    expect(
      pickCity([feature('شرم الشيخ', { country: 'SA' })], SHARM, 'EG'),
    ).toBeNull();
    expect(pickCity([outside], SHARM, 'EG')).toBeNull();
  });

  it('takes the whole town over a part of it', () => {
    const picked = pickCity(
      [
        feature('شرم الشيخ وتشمل منطق', {
          type: 'locality',
          point: [34.38, 27.947],
        }),
        feature('شرم الشيخ', { type: 'locality', point: [34.296, 27.864] }),
        feature('قسم شرم الشيخ', { point: [34.325, 27.909] }),
      ],
      SHARM,
      'EG',
    );

    expect(picked?.center).toEqual({ latitude: 27.909, longitude: 34.325 });
  });

  it('takes the same name over one that only contains it', () => {
    const picked = pickCity(
      [
        feature('بني سويف الجديدة', { point: [31.113, 29.04] }),
        feature('بني سويف', { point: [31.097, 29.074] }),
      ],
      { name: 'Bani Sweif', nameAr: 'بني سويف', slug: 'bani-sweif' },
      'EG',
    );

    expect(picked?.center).toEqual({ latitude: 29.074, longitude: 31.097 });
  });

  it('reads a name through its article, accents and punctuation', () => {
    const arish = pickCity(
      [feature('Al Arish', { point: [33.805, 31.128] })],
      ARISH,
      'EG',
    );
    const beniAbbes = pickCity(
      [feature('Béni Abbès', { country: 'DZ', point: [-2.166, 30.131] })],
      { name: 'Beni-Abbes', nameAr: 'بني عباس', slug: 'beni-abbes' },
      'DZ',
    );

    expect(arish?.center).toEqual({ latitude: 31.128, longitude: 33.805 });
    expect(beniAbbes?.center).toEqual({ latitude: 30.131, longitude: -2.166 });
  });
});
