import { env } from 'cloudflare:workers';

import { id, shortId } from '@founders-coffee/core';
import {
  createDb,
  createEvent,
  seed,
  user,
  type Db,
} from '@founders-coffee/db';

export const setupDb = async (): Promise<Db> => {
  const db = createDb((env as unknown as { DB: D1Database }).DB);
  await seed(db);
  await db
    .insert(user)
    .values({
      id: 'usr_prod_host',
      name: 'Producer Host',
      email: 'host@producer.test',
      emailVerified: false,
      role: 'host',
    })
    .onConflictDoNothing()
    .run();
  return db;
};

export const seedEvent = async (
  db: Db,
): Promise<{ id: string; slug: string }> => {
  const eventId = id('evt');
  const slug = `producer-event-${shortId(eventId)}`;
  await createEvent(db, {
    id: eventId,
    slug,
    hostId: 'usr_prod_host',
    marketCode: 'DZ',
    stateCode: '16',
    cityCode: '1',
    title: 'Coffee + Code',
    description: 'Producer localization fixture.',
    venue: 'Café des Délices, Hydra',
    startsAt: new Date('2099-01-15T23:30:00Z'),
    capacity: 30,
    language: 'fr',
    category: 'coffee-meetup',
    status: 'published',
  });
  return { id: eventId, slug };
};
