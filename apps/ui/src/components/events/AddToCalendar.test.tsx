import {
  cleanup,
  fireEvent,
  render,
  screen,
  within,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('AddToCalendar', () => {
  it('offers Google, Apple, and Outlook in one DaisyUI dropdown', () => {
    show(24 * HOUR);
    const group = screen.getByRole('group', { name: 'Add to your calendar' });
    const summary = group.querySelector('summary');
    const details = group.querySelector('details') as HTMLDetailsElement;

    expect(summary?.textContent).toContain('Add to your calendar');
    fireEvent.click(summary as HTMLElement);
    expect(details.open).toBe(true);
    const menu = group.querySelector('ul');

    expect(
      within(menu as HTMLElement)
        .getAllByRole('button')
        .map((option) => option.textContent),
    ).toEqual(['31Google Calendar', 'Apple Calendar', 'Outlook']);
    expect(group.querySelectorAll('svg')).toHaveLength(5);
  });

  it('closes when the user clicks outside the dropdown', () => {
    show(24 * HOUR);
    const group = screen.getByRole('group', { name: 'Add to your calendar' });
    const details = group.querySelector('details') as HTMLDetailsElement;

    fireEvent.click(group.querySelector('summary') as HTMLElement);
    fireEvent.pointerDown(document.body);

    expect(details.open).toBe(false);
  });

  it('opens Google Calendar in a tab of its own', () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null);
    show(24 * HOUR, 'fr');
    const group = screen.getByRole('group', { name: 'Ajouter à votre agenda' });
    const details = group.querySelector('details') as HTMLDetailsElement;
    fireEvent.click(group.querySelector('summary') as HTMLElement);
    fireEvent.click(
      within(group.querySelector('ul') as HTMLElement).getByRole('button', {
        name: 'Google Agenda',
      }),
    );

    expect(open).toHaveBeenCalledWith(
      `/cal/e/${SHORT}?l=fr&to=google`,
      '_blank',
      'noopener,noreferrer',
    );
    expect(details.open).toBe(false);
  });

  it('offers nothing once the meetup has started', () => {
    const { container } = show(-1);

    expect(
      container.innerHTML,
      'a calendar entry for something already under way reminds nobody of anything',
    ).toBe('');
  });
});
