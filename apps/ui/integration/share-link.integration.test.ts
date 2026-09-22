import { createDb, events, seed, user } from '@founders-coffee/db';
import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import worker from '../src/server';

const ORIGIN = 'https://staging.founders.coffee';
const EVENT_ID = 'evt_25b03363854e4768887f4f96641e6667';
const SHARE_ID = '25b03363854e4768887f4f96641e6667';
const ARABIC_SLUG = `لقاء-قهوة-للمؤسسين-${SHARE_ID}`;
const CANONICAL = `/ar/algeria/e/${ARABIC_SLUG}`;

const get = async (pathname: string): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}${encodeURI(pathname)}`, {
      headers: { accept: 'text/html' },
    }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

const destinationOf = (response: Response): string =>
  decodeURIComponent(
    new URL(response.headers.get('location') ?? '', ORIGIN).pathname,
  );

describe('the short link a shared meetup travels as', () => {
  beforeAll(async () => {
    const db = createDb(env.DB);
    await seed(db);
    await db
      .insert(user)
      .values({
        id: 'usr_share_link',
        name: 'Share Link Host',
        email: 'share-link@test.coffee',
        role: 'host',
      })
      .onConflictDoNothing()
      .run();
    await db
      .insert(events)
      .values({
        id: EVENT_ID,
        hostId: 'usr_share_link',
        marketCode: 'DZ',
        stateCode: '16',
        cityCode: '556',
        title: 'لقاء قهوة للمؤسسين',
        description:
          'A published meetup whose slug is Arabic, as most of them are.',
        venue: 'Café des Délices',
        startsAt: new Date('2099-01-15T18:00:00Z'),
        language: 'ar',
        slug: ARABIC_SLUG,
        status: 'published',
      })
      .onConflictDoNothing()
      .run();
  });

  it('is short and free of percent-encoding, which the canonical address is not', () => {
    const shared = `${ORIGIN}/ar/e/${SHARE_ID}`;
    const canonical = `${ORIGIN}${encodeURI(CANONICAL)}`;

    expect(shared).toBe(encodeURI(shared));
    expect(
      canonical.length,
      'a wall of %D9%82%D9%87 is what a messenger pastes, and what reads as spam',
    ).toBeGreaterThan(shared.length * 2);
  });

  it.each(['ar', 'fr', 'en'])(
    'sends a reader in %s to the canonical page, in that language',
    async (locale) => {
      const response = await get(`/${locale}/e/${SHARE_ID}`);

      expect(response.status).toBe(307);
      expect(destinationOf(response)).toBe(
        `/${locale}/algeria/e/${ARABIC_SLUG}`,
      );
    },
  );

  it('carries its own language, so it does not need the recipient to have been here', async () => {
    const response = await get(`/fr/e/${SHARE_ID}`);

    expect(
      destinationOf(response).startsWith('/fr/'),
      'no cookie was sent, so anything but fr would mean the link lost its language',
    ).toBe(true);
  });

  it('answers a meetup that does not exist with a not-found rather than a redirect', async () => {
    const response = await get('/ar/e/00000000000000000000000000000000');

    expect(response.status).toBe(404);
  });

  it('still answers the older unprefixed market form', async () => {
    const response = await get(`/algeria/e/${ARABIC_SLUG}`);

    expect(response.status).toBe(307);
    expect(destinationOf(response)).toBe(CANONICAL);
  });
});
