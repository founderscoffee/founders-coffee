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

  it('gives it one bar of its own: the steps and a way home', () => {
    renderHostCreateWizard();

    expect(
      screen.getByRole('link', { name: 'Back to the homepage' }),
    ).toBeTruthy();
    expect(
      screen.getAllByRole('navigation', { name: 'Meetup creation steps' }),
    ).toHaveLength(1);
  });

  it('keeps the step title for screen readers and for focus, hiding it only on a phone', () => {
    renderHostCreateWizard();

    const title = screen.getByRole('heading', {
      level: 2,
      name: 'Where will you host the meetup?',
    });

    expect(title.className).toContain('max-lg:sr-only');
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
