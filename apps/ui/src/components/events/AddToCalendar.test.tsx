import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { AddToCalendar } from './AddToCalendar';

const EVENT_ID = 'evt_25b03363854e4768887f4f96641e6667';
const SHORT = '25b03363854e4768887f4f96641e6667';
const HOUR = 60 * 60 * 1000;

const show = (offset: number, locale: 'ar' | 'fr' | 'en' = 'en') =>
  render(
    <AddToCalendar
      eventId={EVENT_ID}
      startsAt={new Date(Date.now() + offset)}
      locale={locale}
    />,
  );

afterEach(() => cleanup());

describe('AddToCalendar', () => {
  it('offers both calendars as one group named for what it does', () => {
    show(24 * HOUR);
    const group = screen.getByRole('group', { name: 'Add to your calendar' });

    expect(
      within(group)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Google Calendar', 'Apple, Outlook and others']);
  });

  it('hands Google Calendar the meetup in a tab of its own, telling it nothing about this page', () => {
    show(24 * HOUR, 'fr');
    const google = screen.getByRole('link', { name: 'Google Agenda' });

    expect(google.getAttribute('href')).toBe(`/cal/e/${SHORT}?l=fr&to=google`);
    expect(google.getAttribute('target')).toBe('_blank');
    expect(google.getAttribute('rel')).toBe('noreferrer');
  });

  it('links the file without a download attribute, which would make every browser save it', () => {
    show(24 * HOUR, 'ar');
    const file = screen.getByRole('link', {
      name: 'Apple أو Outlook أو غيرهما',
    });

    expect(file.getAttribute('href')).toBe(`/cal/e/${SHORT}?l=ar`);
    expect(
      file.hasAttribute('download'),
      'a browser that can add a calendar file to its calendar should be left to',
    ).toBe(false);
    expect(file.hasAttribute('target')).toBe(false);
  });

  it('offers nothing once the meetup has started', () => {
    const { container } = show(-1);

    expect(
      container.innerHTML,
      'a calendar entry for something already under way reminds nobody of anything',
    ).toBe('');
  });
});
