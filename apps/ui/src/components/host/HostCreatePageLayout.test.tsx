import { fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  renderHostCreateWizard,
  resetHostCreateFixtures,
} from './HostCreatePage.fixtures';

const VENUE_REQUIRED = 'Choose a supported venue to continue.';

const next = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Next' }));

describe('the host wizard on a phone', () => {
  afterEach(resetHostCreateFixtures);

  it('gives the steps one bar of their own, and the way home to the action bar', () => {
    renderHostCreateWizard();

    const home = screen.getByRole('link', { name: 'Back to the homepage' });

    expect(
      home.parentElement,
      'the way home sits level with Next, where the thumb already is, not across the screen from it',
    ).toBe(screen.getByRole('button', { name: 'Next' }).parentElement);
    expect(
      screen.getAllByRole('navigation', { name: 'Meetup creation steps' }),
    ).toHaveLength(1);
  });

  it('steps back instead of leaving once past the first step', async () => {
    renderHostCreateWizard();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Choose venue' }),
    );
    next();

    expect(
      screen.queryByRole('link', { name: 'Back to the homepage' }),
      'two ways back side by side, one of them out of the wizard',
    ).toBeNull();
    expect(screen.getByRole('button', { name: 'Back' })).toBeTruthy();
  });

  it('keeps the step title for screen readers and for focus, hiding it only on a phone', () => {
    renderHostCreateWizard();

    const title = screen.getByRole('heading', {
      level: 2,
      name: 'Where will you host the meetup?',
    });

    expect(title.className).toContain('max-lg:sr-only');
    expect(
      title.className,
      'scrolled to the top edge on a step change, the title left the search box under the sticky steps bar',
    ).toContain('max-lg:scroll-mt-20');
    expect(
      title.parentElement?.querySelectorAll('p'),
      'the subtitle said what the search box already says (#121)',
    ).toHaveLength(0);
  });

  it('points to the map once, not twice', () => {
    renderHostCreateWizard();

    expect(
      screen.getAllByText(/on the map/u),
      'the empty list and the action bar each said to use the map (#121)',
    ).toHaveLength(1);
  });

  it('raises the missing venue as a toast the host can put away, and again on the next try', () => {
    renderHostCreateWizard();
    next();

    const toast = screen
      .getByText(VENUE_REQUIRED)
      .closest('[role="alert"]') as HTMLElement;
    fireEvent.click(
      within(toast).getByRole('button', { name: 'Dismiss notification' }),
    );

    expect(screen.queryByText(VENUE_REQUIRED)).toBeNull();

    next();

    expect(
      screen.getByText(VENUE_REQUIRED),
      'a dismissed error has to come back when the host tries again',
    ).toBeTruthy();
  });
});
