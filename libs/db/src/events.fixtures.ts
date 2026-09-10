import { env } from 'cloudflare:workers';

import { createDb, seed, user, type Db, type NewUser } from './index.js';

const TEST_HOST_ID = 'usr_testhost01';
const OTHER_HOST_ID = 'usr_testhost02';

const testHost: NewUser = {
  id: TEST_HOST_ID,
  name: 'Test Host',
  email: 'host@test.coffee',
  emailVerified: false,
  role: 'host',
};

const otherHost: NewUser = {
  id: OTHER_HOST_ID,
  name: 'Other Host',
  email: 'other-host@test.coffee',
  emailVerified: false,
  role: 'host',
};

const baseEvent = {
  hostId: TEST_HOST_ID,
  marketCode: 'DZ' as const,
  stateCode: '16',
  cityCode: '1',
  title: 'Coffee + Code: Algiers',
  description: 'Casual meetup for founders + builders in Algiers.',
  venue: 'Café des Délices, Hydra',
  startsAt: new Date('2099-01-15T18:00:00Z'),
  language: 'fr' as const,
  status: 'published' as const,
};

const setupDb = async (): Promise<Db> => {
  const db = createDb(env.DB);
  await seed(db);
  await db.insert(user).values(testHost).onConflictDoNothing().run();
  await db.insert(user).values(otherHost).onConflictDoNothing().run();
  return db;
};

let counter = 0;
let slugCounter = 0;
const nextId = () => `evt_t${String(++counter).padStart(3, '0')}`;
const nextSlug = () => `test-slug-${++slugCounter}`;

export { TEST_HOST_ID, OTHER_HOST_ID, baseEvent, setupDb, nextId, nextSlug };
