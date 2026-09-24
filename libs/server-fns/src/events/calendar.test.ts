import { describe, expect, it } from 'vitest';

import { id, shortId } from '@founders-coffee/core';
import { createEvent, events, type Db } from '@founders-coffee/db';
import { eq } from 'drizzle-orm';

import { answerEventCalendar } from './calendar.js';
import { baseEvent, setupDb } from './resolver.fixtures.js';

const ORIGIN = 'https://staging.founders.coffee';

const eventWith = async (
  db: Db,
  status: 'published' | 'cancelled',
): Promise<string> => {
  const eventId = id('evt');
  await createEvent(db, {
    ...baseEvent(eventId, `calendar-${eventId}`),
    title: 'لقاء قهوة للمؤسسين',
    language: 'ar',
    endsAt: new Date('2099-01-15T20:00:00Z'),
  });
  if (status !== 'published')
    await db.update(events).set({ status }).where(eq(events.id, eventId)).run();
  return eventId;
};

const ask = (
  db: Db,
  eventId: string,
  target: 'ics' | 'google',
  locale: 'ar' | 'fr' | 'en' = 'fr',
) => answerEventCalendar(db, { id: eventId, locale, target, origin: ORIGIN });

describe('answerEventCalendar', () => {
  it('answers a published meetup with its calendar file', async () => {
    const db = await setupDb();
    const eventId = await eventWith(db, 'published');

    const answer = await ask(db, eventId, 'ics');

    expect(answer?.kind).toBe('file');
    const body = answer?.kind === 'file' ? answer.body : '';
    expect(body).toContain(`UID:${eventId}\r\n`);
    expect(body).toContain('SUMMARY;LANGUAGE=ar:لقاء قهوة للمؤسسين\r\n');
    expect(body).toContain('DTSTART:20990115T180000Z\r\n');
    expect(body).toContain('DTEND:20990115T200000Z\r\n');
  });

  it('links the entry back to the meetup, in the language it was asked for, on this origin', async () => {
    const db = await setupDb();
    const eventId = await eventWith(db, 'published');

    const answer = await ask(db, eventId, 'ics', 'en');
    const body =
      answer?.kind === 'file' ? answer.body.replace(/\r\n /g, '') : '';

    expect(body).toContain(`URL:${ORIGIN}/en/e/${shortId(eventId)}\r\n`);
  });

  it('hands the meetup to Google Calendar, filled in and timed in its market', async () => {
    const db = await setupDb();
    const eventId = await eventWith(db, 'published');

    const answer = await ask(db, eventId, 'google');

    expect(answer?.kind).toBe('redirect');
    const location = new URL(
      answer?.kind === 'redirect' ? answer.location : '',
    );
    expect(`${location.origin}${location.pathname}`).toBe(
      'https://calendar.google.com/calendar/render',
    );
    expect(location.searchParams.get('text')).toBe('لقاء قهوة للمؤسسين');
    expect(location.searchParams.get('ctz')).toBe('Africa/Algiers');
    expect(location.searchParams.get('details')).toContain(
      `${ORIGIN}/fr/e/${shortId(eventId)}`,
    );
  });

  it.each(['ics', 'google'] as const)(
    'sends a %s request for a cancelled meetup to its page, which says why, instead of a calendar',
    async (target) => {
      const db = await setupDb();
      const eventId = await eventWith(db, 'cancelled');

      expect(await ask(db, eventId, target, 'ar')).toEqual({
        kind: 'redirect',
        location: `${ORIGIN}/ar/e/${shortId(eventId)}`,
      });
    },
  );

  it('says nothing about an id no meetup has', async () => {
    const db = await setupDb();

    expect(await ask(db, id('evt'), 'ics')).toBeNull();
  });
});
