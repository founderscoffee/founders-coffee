import { describe, expect, it } from 'vitest';

import {
  googleCalendarUrlFor,
  icsFor,
  type CalendarEvent,
} from './calendar.js';

const EVENT: CalendarEvent = {
  id: 'evt_25b03363854e4768887f4f96641e6667',
  title: 'لقاء قهوة للمؤسسين',
  description: 'We talk pricing and first customers. No slides.',
  language: 'ar',
  venue: 'Café des Délices',
  venueAddress: '12 Rue Didouche Mourad, Alger',
  latitude: 36.7538,
  longitude: 3.0588,
  startsAt: new Date('2026-10-02T17:00:00Z'),
  endsAt: new Date('2026-10-02T19:00:00Z'),
  version: 3,
  updatedAt: new Date('2026-09-24T08:15:30Z'),
  timezone: 'Africa/Algiers',
  url: 'https://founders.coffee/ar/e/25b03363854e4768887f4f96641e6667',
};

const unfolded = (ics: string): string[] =>
  ics.replace(/\r\n /g, '').split('\r\n');

const property = (ics: string, name: string): string | undefined =>
  unfolded(ics).find(
    (line) => line.startsWith(`${name}:`) || line.startsWith(`${name};`),
  );

const valueOf = (ics: string, name: string): string | undefined =>
  property(ics, name)?.replace(/^[^:]*:/, '');

const octets = (text: string): number => new TextEncoder().encode(text).length;

const googleParams = (event: CalendarEvent): URLSearchParams =>
  new URL(googleCalendarUrlFor(event)).searchParams;

describe('icsFor', () => {
  it('writes one published event inside one calendar, every line ended by CRLF', () => {
    const ics = icsFor(EVENT);

    expect(ics.endsWith('\r\n')).toBe(true);
    expect(ics.replace(/\r\n/g, ''), 'a bare LF or CR').not.toMatch(/[\r\n]/);
    expect(unfolded(ics).slice(0, 6)).toEqual([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Founders Coffee//Meetups//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'BEGIN:VEVENT',
    ]);
    expect(unfolded(ics).slice(-3)).toEqual([
      'END:VEVENT',
      'END:VCALENDAR',
      '',
    ]);
  });

  it('names the event by its own id, so adding it twice updates rather than duplicates', () => {
    const ics = icsFor(EVENT);

    expect(valueOf(ics, 'UID')).toBe(EVENT.id);
    expect(
      valueOf(ics, 'SEQUENCE'),
      'each edit bumps the version, which is what tells a calendar this copy is newer',
    ).toBe('3');
    expect(valueOf(ics, 'DTSTAMP')).toBe('20260924T081530Z');
    expect(valueOf(ics, 'STATUS')).toBe('CONFIRMED');
  });

  it('states the times in UTC, which every calendar converts for its reader', () => {
    const ics = icsFor(EVENT);

    expect(valueOf(ics, 'DTSTART')).toBe('20261002T170000Z');
    expect(valueOf(ics, 'DTEND')).toBe('20261002T190000Z');
  });

  it('leaves the end out for a meetup that never had one, rather than inventing a length', () => {
    const ics = icsFor({ ...EVENT, endsAt: null });

    expect(property(ics, 'DTEND')).toBeUndefined();
    expect(valueOf(ics, 'DTSTART')).toBe('20261002T170000Z');
  });

  it('tags what the host wrote with the language they wrote it in', () => {
    const ics = icsFor(EVENT);

    expect(property(ics, 'SUMMARY')).toBe(
      'SUMMARY;LANGUAGE=ar:لقاء قهوة للمؤسسين',
    );
    expect(
      property(ics, 'DESCRIPTION')?.startsWith('DESCRIPTION;LANGUAGE=ar:'),
    ).toBe(true);
  });

  it('puts the link back to the meetup under what the host wrote', () => {
    const ics = icsFor(EVENT);

    expect(valueOf(ics, 'DESCRIPTION')).toBe(
      `We talk pricing and first customers. No slides.\\n\\n${EVENT.url}`,
    );
    expect(valueOf(ics, 'URL')).toBe(EVENT.url);
  });

  it('says where, with the street when there is one, and pins the map point', () => {
    expect(valueOf(icsFor(EVENT), 'LOCATION')).toBe(
      'Café des Délices\\, 12 Rue Didouche Mourad\\, Alger',
    );
    expect(valueOf(icsFor(EVENT), 'GEO')).toBe('36.753800;3.058800');

    const bare = icsFor({
      ...EVENT,
      venueAddress: null,
      latitude: null,
      longitude: null,
    });
    expect(valueOf(bare, 'LOCATION')).toBe('Café des Délices');
    expect(property(bare, 'GEO')).toBeUndefined();
  });

  it('escapes the characters that would otherwise end a value early', () => {
    const ics = icsFor({ ...EVENT, title: 'Pitch; code, \\ coffee' });

    expect(valueOf(ics, 'SUMMARY')).toBe('Pitch\\; code\\, \\\\ coffee');
  });

  it('cannot be made to write a property the host did not get to write', () => {
    const ics = icsFor({
      ...EVENT,
      title: 'Coffee\r\nATTENDEE:mailto:someone@example.com',
      description: 'One\rtwo\nthree\tfour\u0007\u0000\u001f\u007f',
    });

    expect(unfolded(ics).some((line) => line.startsWith('ATTENDEE'))).toBe(
      false,
    );
    expect(valueOf(ics, 'SUMMARY')).toBe(
      'Coffee\\nATTENDEE:mailto:someone@example.com',
    );
    expect(
      valueOf(ics, 'DESCRIPTION'),
      'a tab is text and stays; the other control characters have no place in a value',
    ).toBe(`One\\ntwo\\nthree\tfour\\n\\n${EVENT.url}`);
  });

  it('folds long lines at 75 octets without splitting a character in two', () => {
    const description = `${'وصف طويل للقاء '.repeat(12)}${'☕🚀'.repeat(30)} end`;
    const ics = icsFor({ ...EVENT, description });

    for (const line of ics.split('\r\n'))
      expect(octets(line), line).toBeLessThanOrEqual(75);
    expect(ics).toContain('\r\n ');
    expect(
      new TextDecoder().decode(new TextEncoder().encode(ics)),
      'a fold between the two halves of an emoji leaves each half alone, and neither survives UTF-8',
    ).toBe(ics);
    expect(valueOf(ics, 'DESCRIPTION')).toBe(
      `${description}\\n\\n${EVENT.url}`,
    );
  });

  it('uses the whole 75 octets of a line before folding it', () => {
    const lines = icsFor({ ...EVENT, title: 'a'.repeat(200) }).split('\r\n');
    const start = lines.findIndex((line) => line.startsWith('SUMMARY;'));

    expect(lines.slice(start, start + 3).map(octets)).toEqual([75, 75, 72]);
    expect(lines[start + 3]?.startsWith('DESCRIPTION;')).toBe(true);
  });

  it('asks the calendar for a reminder an hour before, when the room opens', () => {
    const lines = unfolded(icsFor(EVENT));
    const alarm = lines.slice(
      lines.indexOf('BEGIN:VALARM'),
      lines.indexOf('END:VALARM') + 1,
    );

    expect(alarm).toEqual([
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      'TRIGGER:-PT1H',
      'DESCRIPTION;LANGUAGE=ar:لقاء قهوة للمؤسسين',
      'END:VALARM',
    ]);
  });
});

describe('googleCalendarUrlFor', () => {
  it('opens Google Calendar on its own form, filled in', () => {
    const url = new URL(googleCalendarUrlFor(EVENT));

    expect(`${url.origin}${url.pathname}`).toBe(
      'https://calendar.google.com/calendar/render',
    );
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('text')).toBe(EVENT.title);
    expect(url.searchParams.get('location')).toBe(
      'Café des Délices, 12 Rue Didouche Mourad, Alger',
    );
    expect(url.searchParams.get('ctz')).toBe('Africa/Algiers');
  });

  it('writes both times in UTC around a slash Google reads as it is', () => {
    expect(googleCalendarUrlFor(EVENT)).toContain(
      'dates=20261002T170000Z/20261002T190000Z',
    );
    expect(googleParams({ ...EVENT, endsAt: null }).get('dates')).toBe(
      '20261002T170000Z/20261002T170000Z',
    );
  });

  it('carries the description and the link back to the meetup', () => {
    expect(googleParams(EVENT).get('details')).toBe(
      `We talk pricing and first customers. No slides.\n\n${EVENT.url}`,
    );
  });

  it('carries a title whatever it holds, the characters an address reads as its own included', () => {
    expect(
      googleParams({ ...EVENT, title: 'Coffee & code #3 + 50% off?' }).get(
        'text',
      ),
    ).toBe('Coffee & code #3 + 50% off?');
  });

  it('shortens a long description so the address stays one Google will open, and keeps the link', () => {
    const description = 'ق'.repeat(2000);
    const details = googleParams({ ...EVENT, description }).get('details');

    expect(details).toBe(`${'ق'.repeat(500)}…\n\n${EVENT.url}`);
    expect(googleCalendarUrlFor({ ...EVENT, description }).length).toBeLessThan(
      8000,
    );
  });

  it('keeps a description of exactly the limit whole', () => {
    const description = 'ق'.repeat(500);

    expect(googleParams({ ...EVENT, description }).get('details')).toBe(
      `${description}\n\n${EVENT.url}`,
    );
  });

  it('shortens by characters, never through the middle of one', () => {
    const description = '☕🚀'.repeat(400);

    expect(googleParams({ ...EVENT, description }).get('details')).toBe(
      `${'☕🚀'.repeat(250)}…\n\n${EVENT.url}`,
    );
  });
});
