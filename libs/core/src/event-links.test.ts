import { describe, expect, it } from 'vitest';

import {
  CALENDAR_TARGETS,
  eventCalendarPath,
  eventShortPath,
} from './event-links.js';

const EVENT_ID = 'evt_25b03363854e4768887f4f96641e6667';
const SHORT = '25b03363854e4768887f4f96641e6667';

describe('the short address a meetup is handed out at', () => {
  it('leads with the language and carries the id without its prefix', () => {
    expect(eventShortPath('fr', EVENT_ID)).toBe(`/fr/e/${SHORT}`);
  });
});

describe('the address that answers a meetup as a calendar entry', () => {
  it('asks for the file by default, in the language it was offered in', () => {
    expect(eventCalendarPath('ar', EVENT_ID, 'ics')).toBe(
      `/cal/e/${SHORT}?l=ar`,
    );
  });

  it('asks for the hand-off to Google Calendar by name', () => {
    expect(eventCalendarPath('en', EVENT_ID, 'google')).toBe(
      `/cal/e/${SHORT}?l=en&to=google`,
    );
  });

  it('knows exactly the two targets the route answers', () => {
    expect(CALENDAR_TARGETS).toEqual(['ics', 'google']);
  });
});
