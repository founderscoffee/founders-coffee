import { env } from 'cloudflare:workers';
import { describe, expect, it } from 'vitest';

import { createDb, markets, seed, user, type Db } from '@founders-coffee/db';

import {
  eventUrlFor,
  notificationBaseUrl,
  resolveNotificationContext,
} from './context.js';

const setupDb = async (): Promise<Db> => {
  const db = createDb((env as unknown as { DB: D1Database }).DB);
  await seed(db);
  await db
    .insert(user)
    .values({
      id: 'usr_ntfctx',
      name: 'Locale Member',
      email: 'locale@ntf.test',
      emailVerified: false,
      role: 'member',
    })
    .onConflictDoNothing()
    .run();
  return db;
};

describe('notification base url follows the deployment', () => {
  it('links to the configured environment, not a hardcoded production host', () => {
    const configured = (env as unknown as { APP_URL?: string }).APP_URL;
    expect(configured).toBeTruthy();
    expect(notificationBaseUrl()).toBe(configured?.replace(/\/+$/, ''));
    expect(notificationBaseUrl()).not.toBe('https://founders.coffee');
  });

  it('builds an event url on that origin', () => {
    const url = eventUrlFor({ marketCode: 'DZ', eventSlug: 'coffee-code' });
    expect(url.startsWith(notificationBaseUrl())).toBe(true);
    expect(url.endsWith('/DZ/e/coffee-code')).toBe(true);
    expect(url).not.toContain('//DZ');
  });
});

describe('notification locale resolution order', () => {
  it('prefers the stored member preference', async () => {
    const db = await setupDb();
    const context = await resolveNotificationContext(db, {
      preferred: 'fr',
      marketCode: 'DZ',
    });
    expect(context.locale).toBe('fr');
  });

  it('falls back to the market default before anything else', async () => {
    const db = await setupDb();
    const seeded = await db.select().from(markets);
    const dz = seeded.find((market) => market.code === 'DZ');
    expect(dz?.defaultLocale).toBeTruthy();

    const context = await resolveNotificationContext(db, {
      preferred: null,
      marketCode: 'DZ',
    });
    expect(context.locale).toBe(dz?.defaultLocale?.split('-')[0]);
  });

  it('falls back to ar, never en, for an unknown market', async () => {
    const db = await setupDb();
    const context = await resolveNotificationContext(db, {
      preferred: undefined,
      marketCode: 'ZZ',
    });
    expect(context.locale).toBe('ar');
  });

  it('ignores a stored preference that is not a supported locale', async () => {
    const db = await setupDb();
    const context = await resolveNotificationContext(db, {
      preferred: 'de',
      marketCode: 'ZZ',
    });
    expect(context.locale).toBe('ar');
  });

  it('carries the market time zone so dates are not rendered in UTC', async () => {
    const db = await setupDb();
    const context = await resolveNotificationContext(db, {
      preferred: 'en',
      marketCode: 'DZ',
    });
    expect(context.timeZone).toBe('Africa/Algiers');
  });
});
