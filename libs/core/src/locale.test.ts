import { describe, expect, it } from 'vitest';

import { localizedName } from './locale.js';

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
