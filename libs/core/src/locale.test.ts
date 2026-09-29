import { describe, expect, it } from 'vitest';

import {
  foldForSearch,
  localizedName,
  localizedNameMatcher,
  type LocalizedNames,
} from './locale.js';

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

describe('folding one spelling out of many', () => {
  it.each([
    ['أحمد', 'احمد', 'alef with hamza'],
    ['إبراهيم', 'ابراهيم', 'alef with hamza below'],
    ['آحمد', 'احمد', 'alef with madda'],
    ['ٱلمدينة', 'المدينه', 'alef wasla'],
    ['مقهى', 'مقهي', 'alef maqsura'],
    ['قهوة', 'قهوه', 'taa marbuta'],
    ['مــقهي', 'مقهي', 'tatweel'],
    ['أَبْهَا', 'ابها', 'short vowels and sukun'],
    ['مُحَمَّد', 'محمد', 'shadda'],
    ['كتابٌ', 'كتاب', 'tanwin'],
    ['هٰذا', 'هذا', 'a superscript alef'],
    ['بئر', 'بير', 'yaa with hamza'],
    ['Café', 'cafe', 'a French accent'],
    ['  Two   Words  ', 'two words', 'loose whitespace'],
  ])('folds %s to %s (%s)', (input, expected) => {
    expect(foldForSearch(input)).toBe(expected);
  });

  it('folds the two spellings of the same word to each other', () => {
    expect(foldForSearch('مقهى')).toBe(foldForSearch('مقهي'));
  });

  it('leaves a word with nothing to fold as it is', () => {
    expect(foldForSearch('ابها')).toBe('ابها');
  });
});

describe('localizedNameMatcher', () => {
  const alger = { ...algiers, nameFr: 'Alger' };
  const abha = { name: 'Abha', nameAr: 'أبها' };
  const matches = (named: LocalizedNames, query: string) =>
    localizedNameMatcher(query)(named);

  it('matches the Latin name whatever case it is typed in', () => {
    expect(matches(alger, 'algiers')).toBe(true);
    expect(matches(alger, 'ALGIERS')).toBe(true);
  });

  it('matches the Arabic name as written, since Arabic has no case', () => {
    expect(matches(alger, 'الجزائر')).toBe(true);
  });

  it('finds an Arabic name typed without the hamza it is written with', () => {
    expect(matches(abha, 'ابها')).toBe(true);
  });

  it('still finds it typed with the hamza, and finds a name stored without one', () => {
    expect(matches(abha, 'أبها')).toBe(true);
    expect(matches({ name: 'Abha', nameAr: 'ابها' }, 'أبها')).toBe(true);
  });

  it('finds a name written with short vowels typed without them, and the other way round', () => {
    expect(matches({ name: 'Abha', nameAr: 'أَبْهَا' }, 'ابها')).toBe(true);
    expect(matches(abha, 'أَبْهَا')).toBe(true);
  });

  it('answers a French or English query as it did before the Arabic was folded', () => {
    const bejaia = { name: 'Béjaïa', nameAr: 'بجاية' };
    expect(matches(abha, 'abha')).toBe(true);
    expect(matches(abha, 'ABH')).toBe(true);
    expect(matches(bejaia, 'Béjaïa')).toBe(true);
    expect(
      matches(bejaia, 'bejaia'),
      'the fold is for the Arabic name alone; a Latin name still compares with its accents',
    ).toBe(false);
  });

  it('does not take a query that folds away to nothing to be inside every Arabic name', () => {
    expect(matches(abha, 'ـ'), 'a lone tatweel').toBe(false);
    expect(matches(abha, '\u064E'), 'a lone fatha').toBe(false);
  });

  it('matches a name only one language uses', () => {
    expect(
      matches({ name: 'Sharm El-Shaikh', nameFr: 'Charm' }, 'charm'),
      'a French reader typing back the name they were shown finds nothing',
    ).toBe(true);
  });

  it('says no when no name contains the query', () => {
    expect(matches(alger, 'Oran')).toBe(false);
  });

  it('takes a record carrying nothing but a Latin name', () => {
    expect(matches({ name: 'Oran' }, 'ora')).toBe(true);
    expect(matches({ name: 'Oran', nameAr: null }, 'zzz')).toBe(false);
  });
});
