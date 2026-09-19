import { describe, expect, it } from 'vitest';

import { localizedName, matchesLocalizedName } from './locale.js';

const algiers = {
  name: 'Algiers',
  nameAr: 'الجزائر العاصمة',
};

describe('localizedName', () => {
  it('gives an Arabic reader the Arabic name', () => {
    expect(localizedName(algiers, 'ar')).toBe('الجزائر العاصمة');
  });

  it('gives an English reader the Latin name', () => {
    expect(localizedName(algiers, 'en')).toBe('Algiers');
  });

  it('falls back to the Latin name where a locale has none of its own', () => {
    expect(localizedName(algiers, 'fr')).toBe('Algiers');
    expect(localizedName({ name: 'Algeria', nameAr: null }, 'ar')).toBe(
      'Algeria',
    );
  });

  it('reads nameFr once a record carries one, without a signature change', () => {
    const withFrench = { ...algiers, nameFr: 'Alger' };
    expect(localizedName(withFrench, 'fr')).toBe('Alger');
    expect(localizedName(withFrench, 'en')).toBe('Algiers');
    expect(localizedName(withFrench, 'ar')).toBe('الجزائر العاصمة');
  });
});

describe('matchesLocalizedName', () => {
  const alger = { ...algiers, nameFr: 'Alger' };

  it('matches the Latin name whatever case it is typed in', () => {
    expect(matchesLocalizedName(alger, 'algiers')).toBe(true);
    expect(matchesLocalizedName(alger, 'ALGIERS')).toBe(true);
  });

  it('matches the Arabic name as written, since Arabic has no case', () => {
    expect(matchesLocalizedName(alger, 'الجزائر')).toBe(true);
  });

  it('matches a name only one language uses', () => {
    expect(
      matchesLocalizedName(
        { name: 'Sharm El-Shaikh', nameFr: 'Charm' },
        'charm',
      ),
      'a French reader typing back the name they were shown finds nothing',
    ).toBe(true);
  });

  it('says no when no name contains the query', () => {
    expect(matchesLocalizedName(alger, 'Oran')).toBe(false);
  });

  it('takes a record carrying nothing but a Latin name', () => {
    expect(matchesLocalizedName({ name: 'Oran' }, 'ora')).toBe(true);
    expect(matchesLocalizedName({ name: 'Oran', nameAr: null }, 'zzz')).toBe(
      false,
    );
  });
});
