import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import { createDb, events, seed, user } from '@founders-coffee/db';

import worker from '../src/server';

const ORIGIN = 'https://founders.coffee';
const CAIRO_MEETUP = 'cafe-des-fondateurs';

const documentAt = async (pathname: string): Promise<string> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}${pathname}`, { headers: { accept: 'text/html' } }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  expect(response.status, pathname).toBe(200);
  return response.text();
};

describe('the French pages put à in front of a place the way French does', () => {
  beforeAll(async () => {
    const db = createDb(env.DB);
    await seed(db);
    await db
      .insert(user)
      .values({
        id: 'usr_cairo_host',
        name: 'Cairo Host',
        email: 'cairo-host@test.coffee',
        role: 'host',
      })
      .onConflictDoNothing()
      .run();
    await db
      .insert(events)
      .values({
        id: 'evt_cairo_meetup',
        hostId: 'usr_cairo_host',
        marketCode: 'EG',
        stateCode: '1',
        cityCode: '397',
        title: 'Café des fondateurs',
        description: 'Une rencontre de fondateurs autour d’un café.',
        venue: 'Café Riche',
        startsAt: new Date('2099-01-15T18:00:00Z'),
        language: 'fr',
        slug: CAIRO_MEETUP,
        status: 'published',
      })
      .onConflictDoNothing()
      .run();
  });

  it('lists the meetups au Caire, never à Le Caire', async () => {
    const body = await documentAt('/fr/egypt/cairo');

    expect(body).toContain('Prochaines rencontres au Caire');
    expect(
      body,
      'the page repeats the city in its heading, its meta descriptions and its JSON-LD',
    ).not.toMatch(/à Le Caire/u);
  });

  it('invites a host aux Eucalyptus, never à Les Eucalyptus', async () => {
    const body = await documentAt('/fr/algeria/les-eucalyptus');

    expect(body).toContain(
      'Soyez le premier à organiser une rencontre d’entrepreneurs aux Eucalyptus',
    );
    expect(body).not.toMatch(/à Les Eucalyptus/u);
  });

  it('leads back from a Cairo meetup au Caire, never à Cairo', async () => {
    const body = await documentAt(`/fr/egypt/e/${CAIRO_MEETUP}`);

    expect(
      body,
      'the meetup named its city in English, Retour à Cairo',
    ).toContain('Retour au Caire');
    expect(body).toMatch(/<title>[^<]* · Le Caire<\/title>/u);
    expect(
      body,
      'the title, the card and the breadcrumbs name the city too',
    ).not.toMatch(/à Cairo|· Cairo/u);
  });
});
