import { eventCalendarPath } from '@founders-coffee/core';
import { createDb, events, seed, user } from '@founders-coffee/db';
import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from 'cloudflare:test';
import { beforeAll, describe, expect, it } from 'vitest';

import worker from '../src/server';

const ORIGIN = 'https://staging.founders.coffee';
const PUBLISHED_ID = 'evt_5c1e4d2a9b8f4e0c8d7a6b5c4d3e2f10';
const PUBLISHED_SHORT = '5c1e4d2a9b8f4e0c8d7a6b5c4d3e2f10';
const CANCELLED_ID = 'evt_6d2f5e3b0c9a4f1d9e8b7c6d5e4f3a21';
const CANCELLED_SHORT = '6d2f5e3b0c9a4f1d9e8b7c6d5e4f3a21';

const get = async (path: string): Promise<Response> => {
  const context = createExecutionContext();
  const response = await worker.fetch(
    new Request(`${ORIGIN}${path}`),
    env,
    context,
  );
  await waitOnExecutionContext(context);
  return response;
};

const meetup = (
  id: string,
  slug: string,
  status: 'published' | 'cancelled',
) => ({
  id,
  hostId: 'usr_calendar_host',
  marketCode: 'DZ',
  stateCode: '16',
  cityCode: '556',
  title: 'Café, pitch; and code',
  description: 'Bring one question about pricing.',
  venue: 'Café des Délices',
  startsAt: new Date('2099-01-15T18:00:00Z'),
  endsAt: new Date('2099-01-15T20:00:00Z'),
  language: 'fr' as const,
  slug,
  status,
});

describe('a meetup as a calendar entry', () => {
  beforeAll(async () => {
    const db = createDb(env.DB);
    await seed(db);
    await db
      .insert(user)
      .values({
        id: 'usr_calendar_host',
        name: 'Calendar Host',
        email: 'calendar-host@test.coffee',
        role: 'host',
      })
      .onConflictDoNothing()
      .run();
    await db
      .insert(events)
      .values([
        meetup(PUBLISHED_ID, `cafe-pitch-${PUBLISHED_SHORT}`, 'published'),
        meetup(CANCELLED_ID, `cafe-called-off-${CANCELLED_SHORT}`, 'cancelled'),
      ])
      .onConflictDoNothing()
      .run();
  });

  it('answers the address the page and the email link to with a calendar file', async () => {
    const response = await get(eventCalendarPath('fr', PUBLISHED_ID, 'ics'));
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe(
      'text/calendar; charset=utf-8',
    );
    expect(response.headers.get('content-disposition')).toBe(
      'attachment; filename="founders-coffee.ics"',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body.startsWith('BEGIN:VCALENDAR\r\n')).toBe(true);
    expect(body).toContain(`UID:${PUBLISHED_ID}\r\n`);
    expect(body).toContain('SUMMARY;LANGUAGE=fr:Café\\, pitch\\; and code\r\n');
    expect(body.replace(/\r\n /g, '')).toContain(
      `URL:${ORIGIN}/fr/e/${PUBLISHED_SHORT}\r\n`,
    );
  });

  it('hands the meetup to Google Calendar when asked to', async () => {
    const response = await get(eventCalendarPath('en', PUBLISHED_ID, 'google'));
    const location = new URL(response.headers.get('location') ?? '');

    expect(response.status).toBe(302);
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(`${location.origin}${location.pathname}`).toBe(
      'https://calendar.google.com/calendar/render',
    );
    expect(location.searchParams.get('text')).toBe('Café, pitch; and code');
    expect(location.searchParams.get('details')).toContain(
      `${ORIGIN}/en/e/${PUBLISHED_SHORT}`,
    );
  });

  it('sends a link to a cancelled meetup to the page that says it is off', async () => {
    const response = await get(eventCalendarPath('ar', CANCELLED_ID, 'ics'));

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe(
      `${ORIGIN}/ar/e/${CANCELLED_SHORT}`,
    );
  });

  it('writes the entry in Arabic when the language it names is not one this site speaks', async () => {
    const body = await (await get(`/cal/e/${PUBLISHED_SHORT}?l=de`)).text();

    expect(body.replace(/\r\n /g, '')).toContain(
      `URL:${ORIGIN}/ar/e/${PUBLISHED_SHORT}\r\n`,
    );
  });

  it.each([
    ['an id no meetup has', '/cal/e/00000000000000000000000000000000?l=fr'],
    ['an id too long to be one', `/cal/e/${'a'.repeat(80)}?l=fr`],
  ])('answers %s with a 404', async (_case, path) => {
    const response = await get(path);

    expect(response.status).toBe(404);
    expect(response.headers.get('cache-control')).toBe('no-store');
  });
});
