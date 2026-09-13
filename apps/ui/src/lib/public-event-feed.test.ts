import { describe, expect, it } from 'vitest';

import type { PublicEventFeedPage } from '@founders-coffee/server-fns';

import { publicEventFeedJson } from './public-event-feed';

const page: PublicEventFeedPage = {
  items: [
    {
      market: 'algeria',
      city: 'algiers',
      cityName: 'Algiers',
      slug: 'coffee-and-code',
      title: 'Coffee and Code',
      description: 'A local meetup for founders and builders.',
      venue: 'Café des Délices',
      venueAddress: 'Hydra, Algiers',
      startsAt: '2099-01-15T18:00:00.000Z',
      endsAt: '2099-01-15T20:00:00.000Z',
      timezone: 'Africa/Algiers',
      language: 'en',
      organizer: { name: 'Test Host' },
      status: 'published',
      updatedAt: '2099-01-01T12:00:00.000Z',
    },
  ],
  nextCursor: 'cursor',
};

describe('public event feed response', () => {
  it('adds canonical event URLs and preserves only public fields', () => {
    const parsed = JSON.parse(
      publicEventFeedJson('https://founders.coffee/', page),
    ) as Record<string, unknown>;
    const item = (parsed.items as Array<Record<string, unknown>>)[0];

    expect(item.url).toBe(
      'https://founders.coffee/en/algeria/e/coffee-and-code',
    );
    expect(item).not.toHaveProperty('id');
    expect(item).not.toHaveProperty('hostId');
    expect(item).not.toHaveProperty('rsvps');
    expect(parsed.nextCursor).toBe('cursor');
  });
});
