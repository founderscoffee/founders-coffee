import { describe, expect, it } from 'vitest';

import { eventCalendarPath } from '@founders-coffee/core';

import { isCalendarEntryPath } from './calendar-entry';

const EVENT_ID = 'evt_25b03363854e4768887f4f96641e6667';

const pathOf = (address: string): string =>
  new URL(address, 'https://founders.coffee').pathname;

describe('which requests the service worker always sends to the network', () => {
  it.each(['ics', 'google'] as const)(
    'includes the %s address the event page and the email link to',
    (target) => {
      expect(
        isCalendarEntryPath(pathOf(eventCalendarPath('fr', EVENT_ID, target))),
      ).toBe(true);
    },
  );

  it.each([
    '/',
    '/ar/e/25b03363854e4768887f4f96641e6667',
    '/fr/algeria/alger/e/cafe-25b03363854e4768887f4f96641e6667',
    '/calendar',
    '/cal',
  ])('leaves %s to the usual caching', (path) => {
    expect(isCalendarEntryPath(path)).toBe(false);
  });
});
