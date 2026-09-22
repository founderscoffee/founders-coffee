import { describe, expect, it, vi } from 'vitest';

const snapshot = vi.hoisted(() => ({ list: [] as unknown[] }));

vi.mock('@founders-coffee/domain', () => ({
  venues: { getCityVenues: () => snapshot.list },
}));

const { foldForSearch, searchSnapshotVenues, withoutSnapshotDuplicates } =
  await import('./snapshot-search.js');

const venue = (over: Record<string, unknown> = {}) => ({
  providerId: 'osm:node/1',
  kind: 'poi' as const,
  name: 'مقهى الشرق',
  nameLatin: 'Cafe El Charq',
  address: 'شارع ديدوش مراد',
  latitude: 36.365,
  longitude: 6.6147,
  category: 'cafe' as const,
  eligible: true,
  ...over,
});

const search = (query: string, list: unknown[] = [venue()]) => {
  snapshot.list = list;
  return searchSnapshotVenues('DZ', '891', query).map((found) => found.name);
};

describe('folding one spelling out of many', () => {
  it.each([
    ['أحمد', 'احمد', 'alef with hamza'],
    ['آحمد', 'احمد', 'alef with madda'],
    ['مقهى', 'مقهي', 'alef maqsura'],
    ['قهوة', 'قهوه', 'taa marbuta'],
    ['مــقهي', 'مقهي', 'tatweel'],
    ['Café', 'cafe', 'a French accent'],
    ['  Two   Words  ', 'two words', 'loose whitespace'],
  ])('folds %s to %s (%s)', (input, expected) => {
    expect(foldForSearch(input)).toBe(expected);
  });

  it('folds the two spellings of the same word to each other', () => {
    expect(foldForSearch('مقهى')).toBe(foldForSearch('مقهي'));
  });
});

describe('searching the venues the market ships with', () => {
  it('finds a venue by the Arabic name it is recorded under', () => {
    expect(search('الشرق')).toEqual(['مقهى الشرق']);
  });

  it('finds it through a spelling the reader is free to use', () => {
    expect(
      search('مقهي'),
      'the dataset records مقهي حيدرة with a yaa where a reader types an alef maqsura; neither spelling is wrong and both mean the same cafe',
    ).toEqual(['مقهى الشرق']);
  });

  it('finds it by its Latin name as well', () => {
    expect(search('charq')).toEqual(['مقهى الشرق']);
  });

  it('finds it by street, which a single city can afford to match on', () => {
    expect(search('ديدوش')).toEqual(['مقهى الشرق']);
  });

  it('offers nothing the host would be refused for picking', () => {
    expect(
      search('الشرق', [venue({ eligible: false })]),
      'publishing checks the same flag, so an ineligible venue offered here is a rejection one step later',
    ).toEqual([]);
  });

  it('answers a name before a street', () => {
    expect(
      search('الشرق', [
        venue({
          providerId: 'osm:node/2',
          name: 'برج',
          nameLatin: 'Bordj',
          address: 'الشرق',
        }),
        venue(),
      ]),
    ).toEqual(['مقهى الشرق', 'برج']);
  });

  it('says nothing when no city was named to search inside', () => {
    snapshot.list = [venue()];
    expect(searchSnapshotVenues('DZ', undefined, 'مقهى')).toEqual([]);
  });
});

describe('keeping the same cafe from being offered twice', () => {
  const stored = {
    providerId: 'osm:node/1',
    kind: 'poi' as const,
    name: 'مقهى الشرق',
    address: 'شارع ديدوش مراد',
    latitude: 36.365,
    longitude: 6.6147,
  };
  const known = [stored];

  it('drops a provider result that is the same place under another id', () => {
    expect(
      withoutSnapshotDuplicates(known, [
        { ...stored, providerId: 'mapbox.123', latitude: 36.3651 },
      ]),
      'the two sources give the same cafe different ids, so comparing ids finds no duplicate and the reader is offered it twice',
    ).toEqual([]);
  });

  it('keeps a different cafe that happens to share the name', () => {
    expect(
      withoutSnapshotDuplicates(known, [
        {
          ...stored,
          providerId: 'mapbox.123',
          latitude: 36.5,
          longitude: 6.9,
        },
      ]).length,
      'every city has more than one مقهى; only one of them is at this address',
    ).toBe(1);
  });

  it('keeps a different cafe at the same address', () => {
    expect(
      withoutSnapshotDuplicates(known, [
        { ...stored, providerId: 'mapbox.123', name: 'مقهى النصر' },
      ]).length,
    ).toBe(1);
  });
});
