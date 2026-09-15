import { env } from 'cloudflare:workers';

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

export const HOST_ID = 'usr_rsvpresolvehost';

export const members: NewUser[] = Array.from({ length: 4 }, (_, i) => ({
  id: `usr_rr${i}`,
  name: `Resolver Member ${i}`,
  email: `rr${i}@resolve.test`,
  emailVerified: false,
  role: 'member' as const,
}));

let counter = 0;

export const setupDb = async (): Promise<Db> => {
  const db = createDb(env.DB);
  await seed(db);
  await db
    .update(markets)
    .set({ state: 'active' })
    .where(eq(markets.code, 'DZ'))
    .run();
  await db
    .insert(user)
    .values([
      {
        id: HOST_ID,
        name: 'Resolver Host',
        email: 'host@resolve.test',
        emailVerified: false,
        role: 'host',
      },
      ...members,
    ])
    .onConflictDoNothing()
    .run();
  return db;
};

export const seedEvent = async (
  db: Db,
  overrides: { status?: 'published' | 'draft' } = {},
): Promise<string> => {
  const n = ++counter;
  const id = `evt_rr${String(n).padStart(3, '0')}`;
  await createEvent(db, {
    id,
    slug: `resolver-rsvp-${n}`,
    hostId: HOST_ID,
    marketCode: 'DZ',
    stateCode: '16',
    cityCode: '1',
    title: `Resolver RSVP ${n}`,
    description: 'RSVP resolver fixture.',
    venue: 'Café des Délices, Hydra',
    startsAt: new Date('2099-01-15T18:00:00Z'),
    language: 'fr',
    status: overrides.status ?? 'published',
  });
  return id;
};
