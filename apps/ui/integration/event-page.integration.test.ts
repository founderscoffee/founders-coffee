import { createDb, events, seed, user } from '@founders-coffee/db';
import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import worker from '../src/server';

const ORIGIN = 'https://staging.founders.coffee';
const HOST_ID = 'usr_event_page';
const SLUG = 'event-page-meetup';
const NEIGHBOUR = 'Neighbouring meetup in Algiers';

const get = async (pathname: string): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}${pathname}`, {
      headers: { accept: 'text/html' },
    }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

describe("a meetup's page", () => {
  beforeAll(async () => {
    const db = createDb(env.DB);
    await seed(db);
    await db
      .insert(user)
      .values({
        id: HOST_ID,
        name: 'Event Page Host',
        email: 'event-page@test.coffee',
        role: 'host',
      })
      .onConflictDoNothing()
      .run();
    await db
      .insert(events)
      .values({
        id: 'evt_event_page',
        hostId: HOST_ID,
        marketCode: 'DZ',
        stateCode: '16',
        cityCode: '556',
        title: 'Event page meetup',
        description: 'A published meetup, read the way its page reads it.',
        venue: 'Café des Délices',
        startsAt: new Date('2099-01-15T18:00:00Z'),
        language: 'fr',
        slug: SLUG,
        status: 'published',
      })
      .onConflictDoNothing()
      .run();
    await db
      .insert(events)
      .values({
        id: 'evt_event_page_neighbour',
        hostId: HOST_ID,
        marketCode: 'DZ',
        stateCode: '16',
        cityCode: '556',
        title: NEIGHBOUR,
        description: 'Another published meetup in the same market.',
        venue: 'Café des Délices',
        startsAt: new Date('2099-01-22T18:00:00Z'),
        language: 'fr',
        slug: 'event-page-neighbour',
        status: 'published',
      })
      .onConflictDoNothing()
      .run();
  });

  it('shows the meetup and the card of the member hosting it', async () => {
    const response = await get(`/fr/algeria/e/${SLUG}`);
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(body).toContain('Event page meetup');
    expect(body).toContain('Event Page Host');
    expect(body, 'the host card links to their profile').toContain(
      `/u/${HOST_ID}`,
    );
  });

  it("reads nothing of its market's landing", async () => {
    const landing = await (await get('/fr/algeria')).text();
    const page = await (await get(`/fr/algeria/e/${SLUG}`)).text();

    expect(landing, 'the landing lists every upcoming meetup').toContain(
      NEIGHBOUR,
    );
    expect(
      page,
      "the market route's loader ran under every meetup page, reading the landing's meetups, counts and hosts from D1 beside the page's own reads and handing them to the browser in the page",
    ).not.toContain(NEIGHBOUR);
  });

  it.each([
    ['a market no page lists', `/fr/atlantis/e/${SLUG}`],
    ['a meetup its market does not have', `/fr/egypt/e/${SLUG}`],
    ['a slug longer than any meetup has', `/fr/algeria/e/${'x'.repeat(81)}`],
  ])('answers %s as a missing page', async (_label, path) => {
    const response = await get(path);

    expect(response.status).toBe(404);
  });
});
