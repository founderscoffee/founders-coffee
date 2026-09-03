import { env } from 'cloudflare:workers';

import { AppError, appValidator, ok } from '@founders-coffee/core';
import {
  createDb,
  createEvent,
  eq,
  markets,
  seed,
  user,
  type Db,
  type NewUser,
} from '@founders-coffee/db';
import { eventCreateSchema } from '@founders-coffee/domain';

import type { MapProvider } from '../maps/provider.js';

export const TEST_HOST_ID = 'usr_resolvehost01';

export const testMapProvider = {
  name: 'test-map',
  getCityViewport: async () =>
    ok({
      center: { latitude: 36.7538, longitude: 3.0588 },
      bounds: [2.9, 36.6, 3.3, 36.9] as const,
    }),
  searchVenues: async () => ok([]),
  reverseVenue: async (input) =>
    ok({
      providerId: 'test-venue',
      kind: 'poi' as const,
      name: 'Café des Délices',
      address: '12 Rue des Entrepreneurs, Alger',
      latitude: input.latitude,
      longitude: input.longitude,
    }),
} satisfies MapProvider;

const testHost: NewUser = {
  id: TEST_HOST_ID,
  name: 'Resolve Host',
  email: 'resolve@test.coffee',
  emailVerified: false,
  role: 'host',
};

export const setupDb = async (): Promise<Db> => {
  const db = createDb(env.DB);
  await seed(db);
  await db
    .update(markets)
    .set({
      state: 'active',
      featureFlags: {
        events: true,
        hackathons: false,
        payments: false,
        recruiting: false,
      },
    })
    .where(eq(markets.code, 'DZ'))
    .run();
  await db.insert(user).values(testHost).onConflictDoNothing().run();
  return db;
};

let counter = 0;
export const nextId = (): string =>
  `evt_r${String(++counter).padStart(3, '0')}`;
const nextSlug = (): string => `resolve-slug-${counter}`;

export const baseEvent = (id: string, slug: string) => ({
  hostId: TEST_HOST_ID,
  marketCode: 'DZ' as const,
  stateCode: '16',
  cityCode: '1',
  title: 'Resolver test event',
  description: 'Casual meetup for the resolver test.',
  venue: 'Café des Délices, Hydra',
  startsAt: new Date('2099-01-15T18:00:00Z'),
  capacity: 30,
  language: 'fr' as const,
  category: 'coffee-meetup' as const,
  id,
  slug,
});

export const createTestEvent = async (
  db: Db,
): Promise<{ id: string; slug: string }> => {
  const id = nextId();
  const slug = nextSlug();
  await createEvent(db, baseEvent(id, slug));
  return { id, slug };
};

export const rawCreateInput = (overrides: Record<string, unknown> = {}) => ({
  marketCode: 'DZ',
  cityCode: '1',
  title: 'Resolver creation event',
  description: 'A complete event created through the resolver.',
  venueName: 'Café des Délices',
  venueAddress: '12 Rue des Entrepreneurs, Alger',
  latitude: 36.7538,
  longitude: 3.0588,
  startsAt: new Date('2099-01-15T18:00:00Z').getTime(),
  endsAt: new Date('2099-01-15T19:00:00Z').getTime(),
  capacity: 24,
  language: 'fr',
  category: 'coffee-meetup',
  ...overrides,
});

export const createInput = (overrides: Record<string, unknown> = {}) =>
  eventCreateSchema.parse(rawCreateInput(overrides));

export const validationErrorFor = (input: unknown): AppError | undefined => {
  try {
    appValidator(eventCreateSchema)(input);
    return undefined;
  } catch (error) {
    return error instanceof AppError ? error : undefined;
  }
};
