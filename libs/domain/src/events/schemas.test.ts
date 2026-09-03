import { describe, expect, it } from 'vitest';

import { LOCALES } from '@founders-coffee/core';

import {
  EVENT_CAPACITY_MAX,
  EVENT_CATEGORIES,
  EVENT_DESCRIPTION_MAX_LENGTH,
  EVENT_DESCRIPTION_MIN_LENGTH,
  EVENT_DURATION_MS_MAX,
  EVENT_DURATION_MS_MIN,
  EVENT_TITLE_MAX_LENGTH,
  EVENT_TITLE_MIN_LENGTH,
  EVENT_VENUE_ADDRESS_MAX_LENGTH,
  EVENT_VENUE_ADDRESS_MIN_LENGTH,
  EVENT_VENUE_NAME_MAX_LENGTH,
  EVENT_VENUE_NAME_MIN_LENGTH,
  eventCreateSchema,
} from './schemas.js';

const validInput = (overrides: Record<string, unknown> = {}) => {
  const startsAt = Date.now() + 24 * 60 * 60_000;
  return {
    marketCode: 'DZ',
    cityCode: '1',
    title: 'Founder coffee session',
    description: 'A focused discussion for local founders.',
    venueName: 'Café des Délices',
    venueAddress: '12 Rue des Entrepreneurs, Alger',
    latitude: 36.7538,
    longitude: 3.0588,
    startsAt,
    endsAt: startsAt + 60 * 60_000,
    capacity: 20,
    language: 'fr',
    category: 'coffee-meetup',
    ...overrides,
  };
};

const expectInvalidPath = (
  overrides: Record<string, unknown>,
  path: string,
) => {
  const result = eventCreateSchema.safeParse(validInput(overrides));
  expect(result.success).toBe(false);
  if (!result.success) {
    expect(result.error.issues.some((issue) => issue.path[0] === path)).toBe(
      true,
    );
  }
};

describe('eventCreateSchema', () => {
  it('parses and trims a complete event creation command', () => {
    const result = eventCreateSchema.parse(
      validInput({
        cityCode: ' 1 ',
        title: '  Founder coffee session  ',
        description: '  A focused discussion for local founders.  ',
        venueName: '  Café des Délices  ',
        venueAddress: '  12 Rue des Entrepreneurs, Alger  ',
      }),
    );

    expect(result).toMatchObject({
      cityCode: '1',
      title: 'Founder coffee session',
      description: 'A focused discussion for local founders.',
      venueName: 'Café des Délices',
      venueAddress: '12 Rue des Entrepreneurs, Alger',
    });
  });

  it.each([...LOCALES])('accepts the %s event language', (language) => {
    expect(eventCreateSchema.safeParse(validInput({ language })).success).toBe(
      true,
    );
  });

  it.each(EVENT_CATEGORIES)('accepts the %s category', (category) => {
    expect(eventCreateSchema.safeParse(validInput({ category })).success).toBe(
      true,
    );
  });

  it.each([0, 1, EVENT_CAPACITY_MAX])(
    'accepts the %s capacity boundary',
    (capacity) => {
      expect(
        eventCreateSchema.safeParse(validInput({ capacity })).success,
      ).toBe(true);
    },
  );

  it.each([
    ['title', 'title', 'a'.repeat(EVENT_TITLE_MIN_LENGTH)],
    ['title', 'title', 'a'.repeat(EVENT_TITLE_MAX_LENGTH)],
    ['description', 'description', 'a'.repeat(EVENT_DESCRIPTION_MIN_LENGTH)],
    ['description', 'description', 'a'.repeat(EVENT_DESCRIPTION_MAX_LENGTH)],
    ['venue name', 'venueName', 'a'.repeat(EVENT_VENUE_NAME_MIN_LENGTH)],
    ['venue name', 'venueName', 'a'.repeat(EVENT_VENUE_NAME_MAX_LENGTH)],
    [
      'venue address',
      'venueAddress',
      'a'.repeat(EVENT_VENUE_ADDRESS_MIN_LENGTH),
    ],
    [
      'venue address',
      'venueAddress',
      'a'.repeat(EVENT_VENUE_ADDRESS_MAX_LENGTH),
    ],
  ] as const)('accepts the %s length boundary', (_name, field, value) => {
    expect(
      eventCreateSchema.safeParse(validInput({ [field]: value })).success,
    ).toBe(true);
  });

  it.each([
    ['south latitude', { latitude: -90 }],
    ['north latitude', { latitude: 90 }],
    ['west longitude', { longitude: -180 }],
    ['east longitude', { longitude: 180 }],
  ] as const)('accepts the %s coordinate boundary', (_name, overrides) => {
    expect(eventCreateSchema.safeParse(validInput(overrides)).success).toBe(
      true,
    );
  });

  it.each([
    ['title minimum', { title: 'ab' }, 'title'],
    [
      'title maximum',
      { title: 'a'.repeat(EVENT_TITLE_MAX_LENGTH + 1) },
      'title',
    ],
    ['description minimum', { description: 'too short' }, 'description'],
    [
      'description maximum',
      { description: 'a'.repeat(EVENT_DESCRIPTION_MAX_LENGTH + 1) },
      'description',
    ],
    ['venue name minimum', { venueName: 'x' }, 'venueName'],
    [
      'venue name maximum',
      { venueName: 'a'.repeat(EVENT_VENUE_NAME_MAX_LENGTH + 1) },
      'venueName',
    ],
    ['venue address minimum', { venueAddress: 'x' }, 'venueAddress'],
    [
      'venue address maximum',
      { venueAddress: 'a'.repeat(EVENT_VENUE_ADDRESS_MAX_LENGTH + 1) },
      'venueAddress',
    ],
    ['negative capacity', { capacity: -1 }, 'capacity'],
    ['capacity maximum', { capacity: EVENT_CAPACITY_MAX + 1 }, 'capacity'],
    ['fractional capacity', { capacity: 1.5 }, 'capacity'],
    ['latitude minimum', { latitude: -90.1 }, 'latitude'],
    ['latitude maximum', { latitude: 90.1 }, 'latitude'],
    ['longitude minimum', { longitude: -180.1 }, 'longitude'],
    ['longitude maximum', { longitude: 180.1 }, 'longitude'],
    ['finite latitude', { latitude: Number.NaN }, 'latitude'],
    ['finite longitude', { longitude: Number.POSITIVE_INFINITY }, 'longitude'],
    ['market code', { marketCode: 'dz' }, 'marketCode'],
    ['empty city code', { cityCode: '  ' }, 'cityCode'],
    ['invalid language', { language: 'de' }, 'language'],
    ['invalid category', { category: 'conference' }, 'category'],
  ] as const)('rejects an invalid %s', (_name, overrides, path) =>
    expectInvalidPath(overrides, path),
  );

  it('rejects a start instant that is not in the future', () => {
    const startsAt = Date.now() - 60_000;
    expectInvalidPath({ startsAt, endsAt: startsAt + 60 * 60_000 }, 'startsAt');
  });

  it('rejects an end instant at or before the start', () => {
    const startsAt = Date.now() + 24 * 60 * 60_000;
    expectInvalidPath({ startsAt, endsAt: startsAt }, 'endsAt');
    expectInvalidPath({ startsAt, endsAt: startsAt - 1 }, 'endsAt');
  });

  it('enforces the supported duration boundaries', () => {
    const startsAt = Date.now() + 24 * 60 * 60_000;
    expect(
      eventCreateSchema.safeParse(
        validInput({ startsAt, endsAt: startsAt + EVENT_DURATION_MS_MIN }),
      ).success,
    ).toBe(true);
    expect(
      eventCreateSchema.safeParse(
        validInput({ startsAt, endsAt: startsAt + EVENT_DURATION_MS_MAX }),
      ).success,
    ).toBe(true);
    expectInvalidPath(
      { startsAt, endsAt: startsAt + EVENT_DURATION_MS_MIN - 1 },
      'endsAt',
    );
    expectInvalidPath(
      { startsAt, endsAt: startsAt + EVENT_DURATION_MS_MAX + 1 },
      'endsAt',
    );
  });

  it.each([
    'id',
    'stateCode',
    'hostId',
    'isFree',
    'slug',
    'status',
    'rsvps',
    'createdAt',
    'updatedAt',
    'cancelledAt',
  ])('rejects the server-owned %s field', (field) => {
    expect(
      eventCreateSchema.safeParse(validInput({ [field]: 'forged' })).success,
    ).toBe(false);
  });

  it.each([
    'marketCode',
    'cityCode',
    'title',
    'description',
    'venueName',
    'venueAddress',
    'latitude',
    'longitude',
    'startsAt',
    'endsAt',
    'capacity',
    'language',
    'category',
  ])('requires the %s field', (field) => {
    const input: Record<string, unknown> = validInput();
    delete input[field];
    expect(eventCreateSchema.safeParse(input).success).toBe(false);
  });
});
