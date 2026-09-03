import { describe, expect, it } from 'vitest';

import { eventCreateRequestSchema } from './schemas.js';

const event = {
  marketCode: 'DZ',
  cityCode: '1',
  title: 'Protected event',
  description: 'A complete event for founders in the launch market.',
  venueName: 'Founders Café',
  venueAddress: '12 Startup Street, Algiers',
  latitude: 36.7538,
  longitude: 3.0588,
  startsAt: new Date('2099-01-15T18:00:00Z').getTime(),
  endsAt: new Date('2099-01-15T19:00:00Z').getTime(),
  capacity: 20,
  language: 'en',
  category: 'coffee-meetup',
};

describe('eventCreateRequestSchema', () => {
  it('carries the domain command and nothing else', () => {
    const result = eventCreateRequestSchema.parse({ event });

    expect(result.event).toEqual(event);
    expect(Object.keys(result)).toEqual(['event']);
  });

  it('rejects extra transport fields', () => {
    expect(
      eventCreateRequestSchema.safeParse({ event, forged: true }).success,
    ).toBe(false);
    expect(
      eventCreateRequestSchema.safeParse({
        event,
        turnstileToken: 'single-use-token',
      }).success,
    ).toBe(false);
  });
});
