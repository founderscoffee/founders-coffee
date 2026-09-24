import type { Locale } from '@founders-coffee/core';

export type CalendarEvent = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly language: Locale;
  readonly venue: string;
  readonly venueAddress: string | null;
  readonly latitude: number | null;
  readonly longitude: number | null;
  readonly startsAt: Date;
  readonly endsAt: Date | null;
  readonly version: number;
  readonly updatedAt: Date;
  readonly timezone: string;
  readonly url: string;
};

const GOOGLE_CALENDAR = 'https://calendar.google.com/calendar/render';

const GOOGLE_DESCRIPTION_MAX = 500;

const LINE_OCTETS = 75;

const encoder = new TextEncoder();

/** A moment as iCalendar writes it in UTC, `20261002T170000Z`, which Google reads too. */
const utcStamp = (moment: Date): string =>
  moment
    .toISOString()
    .replace(/\.\d{3}Z$/, 'Z')
    .replace(/[-:]/g, '');

const isAllowedCharacter = (character: string): boolean => {
  const code = character.codePointAt(0) ?? 0;
  return code === 0x09 || code === 0x0a || (code > 0x1f && code !== 0x7f);
};

/**
 * A TEXT value as RFC 5545 §3.3.11 writes it. Every line break becomes the two characters `\n`,
 * so nothing a host typed can end the line and start a property of its own; the separators a
 * value would otherwise end at are escaped, and control characters, which the grammar has no
 * place for, are dropped.
 */
const escapeText = (value: string): string =>
  Array.from(value.replace(/\r\n?/g, '\n'))
    .filter(isAllowedCharacter)
    .join('')
    .replace(/[\\;,]/g, (character) => `\\${character}`)
    .replace(/\n/g, '\\n');

/**
 * A content line folded at 75 octets (RFC 5545 §3.1), each continuation opened by one space.
 *
 * Counted in UTF-8 octets, because that is what the limit is in, and cut only between code
 * points: a fold between the two halves of an emoji would leave each half alone, and neither
 * survives being encoded.
 */
const fold = (line: string): string => {
  const parts: string[] = [];
  let current = '';
  let size = 0;
  for (const character of line) {
    const width = encoder.encode(character).length;
    const limit = parts.length === 0 ? LINE_OCTETS : LINE_OCTETS - 1;
    if (size + width > limit) {
      parts.push(current);
      current = '';
      size = 0;
    }
    current += character;
    size += width;
  }
  return [...parts, current].join('\r\n ');
};

const locationOf = (event: CalendarEvent): string =>
  event.venueAddress ? `${event.venue}, ${event.venueAddress}` : event.venue;

const detailsOf = (description: string, url: string): string =>
  `${description}\n\n${url}`;

const shortened = (text: string, limit: number): string => {
  const characters = Array.from(text);
  return characters.length > limit
    ? `${characters.slice(0, limit).join('')}…`
    : text;
};

/**
 * One meetup as an iCalendar file, to be opened by Apple Calendar, Outlook or anything else that
 * reads `.ics`.
 *
 * The UID is the event's own id and SEQUENCE its version, so a calendar that is handed the file
 * again after an edit can recognise the entry and take the newer copy instead of adding a second.
 * Times are written in UTC: every calendar converts them for its reader, and a member who travels
 * sees the meetup at the right moment wherever they are.
 *
 * What the host wrote is tagged with the language they wrote it in and otherwise left as authored.
 * An alarm an hour before matches when the meetup's room opens, and is the reminder a calendar
 * gives on its own terms.
 */
export const icsFor = (event: CalendarEvent): string => {
  const text = (name: string, value: string): string =>
    `${name};LANGUAGE=${event.language}:${escapeText(value)}`;
  const { latitude, longitude } = event;
  const point =
    latitude !== null && longitude !== null
      ? [`GEO:${latitude.toFixed(6)};${longitude.toFixed(6)}`]
      : [];

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Founders Coffee//Meetups//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.id}`,
    `DTSTAMP:${utcStamp(event.updatedAt)}`,
    `DTSTART:${utcStamp(event.startsAt)}`,
    ...(event.endsAt ? [`DTEND:${utcStamp(event.endsAt)}`] : []),
    `SEQUENCE:${event.version}`,
    'STATUS:CONFIRMED',
    text('SUMMARY', event.title),
    text('DESCRIPTION', detailsOf(event.description, event.url)),
    `LOCATION:${escapeText(locationOf(event))}`,
    ...point,
    `URL:${event.url}`,
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'TRIGGER:-PT1H',
    text('DESCRIPTION', event.title),
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return `${lines.map(fold).join('\r\n')}\r\n`;
};

/**
 * The same meetup as Google Calendar's own event form, filled in.
 *
 * Google Calendar on an Android phone cannot open an `.ics` file, so this is how a member there
 * adds the meetup in one step. The dates go in as written, around a literal slash, which is the
 * form Google documents. The description is cut short, because the whole event rides in the
 * address and an Arabic character is six characters once encoded; the link back to the meetup,
 * which carries the rest, always survives.
 */
export const googleCalendarUrlFor = (event: CalendarEvent): string => {
  const dates = `${utcStamp(event.startsAt)}/${utcStamp(event.endsAt ?? event.startsAt)}`;
  const params: ReadonlyArray<readonly [string, string]> = [
    ['action', 'TEMPLATE'],
    ['text', event.title],
    [
      'details',
      detailsOf(
        shortened(event.description, GOOGLE_DESCRIPTION_MAX),
        event.url,
      ),
    ],
    ['location', locationOf(event)],
    ['ctz', event.timezone],
  ];
  const query = params
    .map(([name, value]) => `${name}=${encodeURIComponent(value)}`)
    .join('&');
  return `${GOOGLE_CALENDAR}?${query}&dates=${dates}`;
};
