import { AppError } from '@founders-coffee/core';

import {
  fillHostDetails,
  getHostCreateMocks,
  goToHostDetails,
  renderHostCreateWizard,
  resetHostCreateFixtures,
} from './HostCreatePage.fixtures';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

const hostCreateMocks = getHostCreateMocks();

describe('HostCreatePage EC-07 flow', () => {
  afterEach(resetHostCreateFixtures);

  it('explains why venue search is unavailable instead of leaving a dead input', async () => {
    hostCreateMocks.mapContext.data = undefined;
    hostCreateMocks.mapContext.isError = true;
    hostCreateMocks.mapContext.error = new AppError(
      'rate_limited',
      'Too many map_context requests',
    );
    renderHostCreateWizard();

    const search = (await screen.findByLabelText(
      'Search cafés and coworking venues',
    )) as HTMLInputElement;
    expect(search.disabled).toBe(true);
    expect(
      await screen.findByText(
        'Too many venue searches. Please wait a moment and try again.',
      ),
    ).toBeTruthy();
  });

  it('submits the complete confirmed draft and stays retryable after failure', async () => {
    hostCreateMocks.mutateAsync.mockRejectedValueOnce(
      new Error('creation failed'),
    );
    renderHostCreateWizard();
    await goToHostDetails();
    fillHostDetails();
    fireEvent.click(screen.getByLabelText('Unlimited'));
    fireEvent.change(screen.getByLabelText(/^Maximum attendees/), {
      target: { value: '24' },
    });
    fireEvent.change(screen.getByLabelText('Language'), {
      target: { value: 'en' },
    });
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'workshop' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      screen.getByRole('heading', { name: 'Review and confirm' }),
    ).toBeTruthy();
    expect(screen.getByText('12 Startup Street, Algiers')).toBeTruthy();
    expect(screen.getByText('English')).toBeTruthy();
    expect(screen.getByText('Workshop')).toBeTruthy();

    const publish = screen.getByRole('button', {
      name: 'Confirm and publish',
    }) as HTMLButtonElement;
    expect(publish.disabled).toBe(false);
    fireEvent.click(publish);

    await waitFor(() =>
      expect(hostCreateMocks.mutateAsync).toHaveBeenCalledOnce(),
    );
    expect(hostCreateMocks.mutateAsync).toHaveBeenCalledWith({
      data: {
        event: expect.objectContaining({
          capacity: 24,
          language: 'en',
          category: 'workshop',
        }),
      },
    });
    await waitFor(() =>
      expect(screen.getByText("Couldn't publish. Try again.")).toBeTruthy(),
    );
    expect(publish.disabled).toBe(false);
  });

  it('preserves an anonymous draft and hands off through a validated return path', async () => {
    hostCreateMocks.isAuthenticated = false;
    window.history.replaceState({}, '', '/algeria/host/create?city=1&state=16');
    renderHostCreateWizard();
    await goToHostDetails();
    fillHostDetails();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    fireEvent.click(screen.getByRole('button', { name: 'Continue to login' }));

    expect(hostCreateMocks.navigate).toHaveBeenCalledWith({
      to: '/login',
      search: {
        redirect: '/algeria/host/create?city=1&state=16',
      },
    });
    const stored = window.sessionStorage.getItem('fc:event-draft:DZ:1');
    expect(stored).toContain('Protected meetup');
  });

  it('restores the confirmation step after auth and a locale reload', async () => {
    hostCreateMocks.isAuthenticated = false;
    const firstRender = renderHostCreateWizard();
    await goToHostDetails();
    fillHostDetails();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(window.sessionStorage.getItem('fc:event-draft:DZ:1')).toContain(
        'Protected meetup',
      ),
    );
    firstRender.unmount();

    hostCreateMocks.isAuthenticated = true;
    renderHostCreateWizard('fr');
    expect(
      await screen.findByRole('heading', { name: 'Vérifier et confirmer' }),
    ).toBeTruthy();
    expect(screen.getByText('Protected meetup')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Confirmer et publier' }),
    ).toBeTruthy();
  });

  it('announces progress and focuses the first invalid field', async () => {
    renderHostCreateWizard();
    expect(
      screen.getByRole('navigation', { name: 'Event creation progress' }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      await screen.findByText('Choose a supported venue to continue.'),
    ).toBeTruthy();
    await waitFor(() =>
      expect(document.activeElement?.id).toBe('venue-search'),
    );
  });
});
