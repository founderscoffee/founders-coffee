import { createDb, events, seed, user } from '@founders-coffee/db';
import { rsvp_box_host, rsvp_box_title } from '@founders-coffee/i18n';
import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import worker from '../src/server';

import { recordD1Rounds } from './d1-rounds.fixtures';
import { signIn } from './sign-in.fixtures';

const ORIGIN = 'https://staging.founders.coffee';
const HOST_ID = 'usr_event_page';
const HOST_EMAIL = 'event-page@test.coffee';
const SLUG = 'event-page-meetup';
const NEIGHBOUR = 'Neighbouring meetup in Algiers';

const get = async (pathname: string, cookie?: string): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}${pathname}`, {
      headers: { accept: 'text/html', ...(cookie ? { cookie } : {}) },
    }),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

const rsvpHeading = (page: string): string | undefined =>
  page.match(/<h2 id="event-rsvp-title"[^>]*>(.*?)<\/h2>/su)?.[1];

describe("a meetup's page", () => {
  beforeAll(async () => {
    const db = createDb(env.DB);
    await seed(db);
    await db
      .insert(user)
      .values({
        id: HOST_ID,
        name: 'Event Page Host',
        email: HOST_EMAIL,
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
        latitude: 36.7538,
        longitude: 3.0588,
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

  it('shows where the meetup is, with directions to it, though no Mapbox token can be read', async () => {
    const response = await get(`/fr/algeria/e/${SLUG}`);
    const body = await response.text();

    expect(
      response.status,
      'the page reads the token beside the meetup, and no token here makes that read fail',
    ).toBe(200);
    expect(body).toContain(
      'href="https://www.google.com/maps/dir/?api=1&amp;destination=36.7538%2C3.0588"',
    );
    expect(
      body,
      'with no token there is no picture of the place to ask Mapbox for',
    ).not.toContain('api.mapbox.com/styles/v1');
    expect(body, 'nor a picture to credit').not.toContain(
      'apps.mapbox.com/feedback',
    );
  });

  it('names its host at the address their profile answers on', async () => {
    const body = await (await get(`/fr/algeria/e/${SLUG}`)).text();
    const meetup = [
      ...body.matchAll(
        /<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gsu,
      ),
    ]
      .map((match) => JSON.parse(match[1] ?? '{}') as Record<string, unknown>)
      .find((node) => node['@type'] === 'Event');
    const organizer = meetup?.organizer as
      { readonly url?: string } | undefined;
    const profile = await get(new URL(organizer?.url ?? '/', ORIGIN).pathname);

    expect(organizer?.url).toBe(`${ORIGIN}/fr/u/${HOST_ID}`);
    expect(
      profile.status,
      'the organizer was /u/<id>, which redirects to the localized profile, so Google followed a redirect to reach the host',
    ).toBe(200);
  });

  it("sends its host their own panel in the page the server renders, and a reader a guest's box", async () => {
    const host = await signIn(HOST_EMAIL);
    const asHost = await (await get(`/fr/algeria/e/${SLUG}`, host)).text();
    const asReader = await (await get(`/fr/algeria/e/${SLUG}`)).text();

    expect(
      rsvpHeading(asHost),
      "the route took the host from the browser's session, which the server renders as still resolving, so the host's own meetup arrived with a guest's RSVP box",
    ).toBe(rsvp_box_host({}, { locale: 'fr' }));
    expect(rsvpHeading(asReader)).toBe(rsvp_box_title({}, { locale: 'fr' }));
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

  it('waits on one trip to D1 for a reader who is signed out', async () => {
    await (await get(`/fr/algeria/e/${SLUG}`)).text();
    const d1 = recordD1Rounds();
    try {
      const response = await get(`/fr/algeria/e/${SLUG}`);
      expect(response.status).toBe(200);
      await response.text();
    } finally {
      d1.restore();
    }

    expect(
      d1.rounds(),
      `with the market list kept by the data centre, the market and the meetup with everything its page shows about its host are one trip; each trip costs a round trip from the Worker to D1's primary (#114):\n${d1.timeline()}`,
    ).toBe(1);
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
