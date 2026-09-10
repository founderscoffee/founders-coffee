import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import {
  createDb,
  createEvent,
  eq,
  scheduledNotifications,
  seed,
  user,
  type Db,
} from '@founders-coffee/db';

import { enqueueRsvpNotifications } from './producer.js';

const ARABIC = /[؀-ۿ]/;
const FRENCH_MARKERS = /confirmé|rappel|Demain|événement/i;

let seq = 0;

const setupDb = async (): Promise<Db> => {
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

const seedEvent = async (db: Db): Promise<{ id: string; slug: string }> => {
  const n = ++seq;
  const id = `evt_prod${String(n).padStart(3, '0')}`;
  const slug = `producer-event-${n}`;
  await createEvent(db, {
    id,
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
  return { id, slug };
};

const enqueueFor = async (
  db: Db,
  locale: string | null,
): Promise<Record<string, unknown>[]> => {
  const event = await seedEvent(db);
  const memberId = `usr_prod_m${seq}`;
  await db
    .insert(user)
    .values({
      id: memberId,
      name: 'Member',
      email: `m${seq}@producer.test`,
      emailVerified: false,
      role: 'member',
    })
    .onConflictDoNothing()
    .run();

  await enqueueRsvpNotifications(db, {
    eventId: event.id,
    userId: memberId,
    eventTitle: 'Coffee + Code',
    eventSlug: event.slug,
    marketCode: 'DZ',
    startsAt: new Date('2099-01-15T23:30:00Z'),
    venue: 'Café des Délices, Hydra',
    phoneNumber: '+213600000000',
    email: `m${seq}@producer.test`,
    locale,
  });

  const rows = await db
    .select()
    .from(scheduledNotifications)
    .where(eq(scheduledNotifications.eventId, event.id));
  return rows.map((row) => row.payload);
};

describe('enqueued notification content is localized (AR-07)', () => {
  it('writes Arabic bodies for an Arabic member', async () => {
    const db = await setupDb();
    const payloads = await enqueueFor(db, 'ar');

    expect(payloads.length).toBeGreaterThan(0);
    const sms = payloads.find((p) => typeof p.smsBody === 'string');
    expect(sms?.smsBody as string).toMatch(ARABIC);
    expect(sms?.smsBody as string).not.toMatch(/You're in/);
  });

  it('writes French bodies for a French member', async () => {
    const db = await setupDb();
    const payloads = await enqueueFor(db, 'fr');
    const sms = payloads.find((p) => typeof p.smsBody === 'string');
    expect(sms?.smsBody as string).toMatch(FRENCH_MARKERS);
  });

  it('uses the market default, not English, when no preference is stored', async () => {
    const db = await setupDb();
    const payloads = await enqueueFor(db, null);
    const sms = payloads.find((p) => typeof p.smsBody === 'string');
    expect(sms?.smsBody as string).not.toMatch(/You're in/);
  });

  it('links to the configured environment rather than production', async () => {
    const db = await setupDb();
    const payloads = await enqueueFor(db, 'en');
    const base = (env as unknown as { APP_URL: string }).APP_URL;
    const sms = payloads.find((p) => typeof p.smsBody === 'string');

    expect(sms?.smsBody as string).toContain(`${base}/algeria/e/`);
    expect(sms?.smsBody as string).not.toContain('https://founders.coffee');
  });

  /** 2099-01-15T23:30Z is Thursday in UTC and Friday in Africa/Algiers. */
  it('renders the date in the market time zone, not the worker UTC', async () => {
    const db = await setupDb();
    const payloads = await enqueueFor(db, 'en');
    const sms = payloads.find((p) => typeof p.smsBody === 'string');

    expect(sms?.smsBody as string).toContain('Friday');
    expect(sms?.smsBody as string).not.toContain('Thursday');
  });

  it('never leaves an unresolved placeholder in a stored payload', async () => {
    const db = await setupDb();
    const payloads = await enqueueFor(db, 'ar');
    for (const payload of payloads) {
      for (const [key, value] of Object.entries(payload)) {
        if (typeof value !== 'string') continue;
        if (key === 'startsAt') continue;
        expect(value, `${key} has an unresolved placeholder`).not.toMatch(
          /\{\w+\}/,
        );
      }
    }
  });
});
