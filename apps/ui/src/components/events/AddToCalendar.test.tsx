import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
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

const openMenu = (groupName: string) => {
  const group = screen.getByRole('group', { name: groupName });
  const details = group.querySelector('details') as HTMLDetailsElement;
  const summary = group.querySelector('summary') as HTMLElement;
  fireEvent.click(summary);
  const menu = within(group.querySelector('ul') as HTMLElement);
  return { details, summary, menu };
};

afterEach(() => cleanup());

describe('AddToCalendar', () => {
  it('offers Google, Apple and Outlook in one dropdown, each with its own logo', () => {
    show(24 * HOUR);
    const { details, menu } = openMenu('Add to your calendar');

    expect(details.open).toBe(true);
    const links = menu.getAllByRole('link');
    expect(links).toEqual([
      menu.getByRole('link', { name: 'Google Calendar' }),
      menu.getByRole('link', { name: 'Apple Calendar' }),
      menu.getByRole('link', { name: 'Outlook' }),
    ]);
    links.forEach((link) =>
      expect(link.querySelector('svg[aria-hidden="true"]')).not.toBeNull(),
    );
  });

  it('links Google Calendar in a tab of its own, without a referrer', () => {
    show(24 * HOUR, 'fr');
    const { menu } = openMenu('Ajouter à votre agenda');
    const google = menu.getByRole('link', { name: 'Google Agenda' });

    expect(google.getAttribute('href')).toBe(`/cal/e/${SHORT}?l=fr&to=google`);
    expect(google.getAttribute('target')).toBe('_blank');
    expect(google.getAttribute('rel')?.split(' ')).toContain('noreferrer');
  });

  it('hands Apple Calendar and Outlook the meetup’s calendar file', () => {
    show(24 * HOUR);
    const { menu } = openMenu('Add to your calendar');

    for (const name of ['Apple Calendar', 'Outlook'])
      expect(menu.getByRole('link', { name }).getAttribute('href')).toBe(
        `/cal/e/${SHORT}?l=en`,
      );
  });

  it('closes once a calendar is chosen', () => {
    show(24 * HOUR);
    const { details, menu } = openMenu('Add to your calendar');
    const outlook = menu.getByRole('link', { name: 'Outlook' });
    outlook.addEventListener('click', (event) => event.preventDefault());

    expect(details.open).toBe(true);
    fireEvent.click(outlook);

    expect(details.open).toBe(false);
  });

  it('closes when the user presses outside the dropdown', () => {
    show(24 * HOUR);
    const { details } = openMenu('Add to your calendar');

    fireEvent.pointerDown(document.body);

    expect(details.open).toBe(false);
  });

  it('closes on Escape and hands focus back to its button', () => {
    show(24 * HOUR);
    const { details, summary, menu } = openMenu('Add to your calendar');
    menu.getByRole('link', { name: 'Google Calendar' }).focus();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(summary);
  });

  it.each([
    ['en', 'Add to your calendar', 'Calendar'],
    ['fr', 'Ajouter à votre agenda', 'Agenda'],
    ['ar', 'أضف إلى تقويمك', 'التقويم'],
  ] as const)(
    'shows a word short enough to share a row, under its full name (%s)',
    (locale, name, label) => {
      show(24 * HOUR, locale);
      const { summary } = openMenu(name);

      expect(
        summary.textContent,
        'the host and the people going get the same button, beside the chat in the 272px rail',
      ).toBe(label);
    },
  );

  it('fills the width it is given', () => {
    show(24 * HOUR);
    const { details, summary } = openMenu('Add to your calendar');

    expect(
      summary.className.split(' '),
      'it shares a row with the chat, and half a row is what it is given',
    ).toContain('w-full');
    expect(details.className.split(' ')).toContain('w-full');
  });

  it('offers nothing once the meetup has started', () => {
    const { container } = show(-1);

    expect(
      container.innerHTML,
      'a calendar entry for something already under way reminds nobody of anything',
    ).toBe('');
  });
});
