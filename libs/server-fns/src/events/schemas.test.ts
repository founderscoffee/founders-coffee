import { describe, expect, it } from 'vitest';

import { eventCreateRequestSchema } from './schemas.js';

const event = {
  marketCode: 'DZ',
  cityCode: '1',
  title: 'Protected event',
  description: 'A complete event protected by Turnstile.',
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
  it('accepts the transport envelope without adding the token to the domain command', () => {
    const result = eventCreateRequestSchema.parse({
      event,
      turnstileToken: 'single-use-token',
    });

    expect(result.event).toEqual(event);
    expect(result.event).not.toHaveProperty('turnstileToken');
    expect(result.turnstileToken).toBe('single-use-token');
  });

  it('rejects extra transport fields and oversized tokens', () => {
    expect(
      eventCreateRequestSchema.safeParse({ event, forged: true }).success,
    ).toBe(false);
    expect(
      eventCreateRequestSchema.safeParse({
        event,
        turnstileToken: 'x'.repeat(2_049),
      }).success,
    ).toBe(false);
  });
});
