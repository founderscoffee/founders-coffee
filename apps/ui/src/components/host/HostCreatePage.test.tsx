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
        'You have searched for venues too often. Wait a moment, then try again.',
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

    const publish = screen.getByRole('button', {
      name: 'Confirm and publish the meetup',
    }) as HTMLButtonElement;
    expect(publish.disabled).toBe(false);
    fireEvent.click(publish);

    await waitFor(() =>
      expect(hostCreateMocks.mutateAsync).toHaveBeenCalledOnce(),
    );
    expect(hostCreateMocks.mutateAsync).toHaveBeenCalledWith({
      data: {
        event: expect.objectContaining({
          language: 'en',
          venueProviderId: 'poi-cafe',
        }),
      },
    });
    await waitFor(() =>
      expect(screen.getByText("Couldn't publish. Try again.")).toBeTruthy(),
    );
    expect(publish.disabled).toBe(false);
  });

  it('asks an anonymous host to sign in without leaving the wizard, and publishes once they do', async () => {
    hostCreateMocks.isAuthenticated = false;
    window.history.replaceState(
      {},
      '',
      '/ar/algeria/host/create?city=1&state=16',
    );
    renderHostCreateWizard();
    await goToHostDetails();
    fillHostDetails();
    fireEvent.click(
      screen.getByRole('button', { name: 'Continue to sign in' }),
    );

    expect(hostCreateMocks.navigate).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: '/login' }),
    );
    expect(
      screen.getByRole('heading', {
        name: 'Sign in to publish',
      }),
    ).toBeTruthy();
    const stored = window.sessionStorage.getItem('fc:event-draft:DZ');
    expect(stored).toContain('Protected meetup');

    fireEvent.click(screen.getByRole('button', { name: 'Solve captcha' }));
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'host@example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
    fireEvent.change(await screen.findByLabelText('Enter the code'), {
      target: { value: '123456' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Verify and sign in' }));

    await waitFor(() => expect(hostCreateMocks.mutateAsync).toHaveBeenCalled());
  });

  it('validates the final step instead of publishing an invalid draft', async () => {
    renderHostCreateWizard();
    await goToHostDetails();
    fireEvent.change(screen.getByLabelText(/^Meetup title/), {
      target: { value: 'x' },
    });
    fireEvent.change(screen.getByLabelText(/^Meetup description/), {
      target: { value: 'A complete protected meetup for founders.' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm and publish the meetup' }),
    );

    expect(hostCreateMocks.mutateAsync).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        'The title must be between 3 and 120 characters.',
      ),
    ).toBeTruthy();
  });

  it('asks an anonymous host to sign in only once the draft is valid', async () => {
    hostCreateMocks.isAuthenticated = false;
    renderHostCreateWizard();
    await goToHostDetails();
    fireEvent.change(screen.getByLabelText(/^Meetup title/), {
      target: { value: 'x' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Continue to sign in' }),
    );

    expect(
      screen.queryByRole('heading', {
        name: 'Sign in to publish',
      }),
    ).toBeNull();
  });

  it('restores the confirmation step after auth and a locale reload', async () => {
    hostCreateMocks.isAuthenticated = false;
    const firstRender = renderHostCreateWizard();
    await goToHostDetails();
    fillHostDetails();
    await waitFor(() =>
      expect(window.sessionStorage.getItem('fc:event-draft:DZ')).toContain(
        'Protected meetup',
      ),
    );
    firstRender.unmount();

    hostCreateMocks.isAuthenticated = true;
    renderHostCreateWizard('fr');
    expect(
      await screen.findByRole('heading', {
        name: 'Quel est le sujet de la rencontre ?',
      }),
    ).toBeTruthy();
    expect(
      (
        screen.getByLabelText(
          /^Titre de la rencontre/,
        ) as unknown as HTMLInputElement
      ).value,
    ).toBe('Protected meetup');
    expect(
      screen.getByRole('button', { name: 'Confirmer et publier la rencontre' }),
    ).toBeTruthy();
  });

  it('announces progress and focuses the first invalid field', async () => {
    renderHostCreateWizard();
    expect(
      screen.getByRole('navigation', { name: 'Meetup creation steps' }),
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

describe('the language a meetup is held in', () => {
  afterEach(resetHostCreateFixtures);

  it('publishes the language the host chose, not the one they read in', async () => {
    renderHostCreateWizard('en');
    await goToHostDetails();
    fillHostDetails();
    fireEvent.change(screen.getByLabelText(/^Language/), {
      target: { value: 'ar' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirm and publish the meetup' }),
    );

    await waitFor(() =>
      expect(hostCreateMocks.mutateAsync).toHaveBeenCalledOnce(),
    );
    expect(hostCreateMocks.mutateAsync).toHaveBeenCalledWith({
      data: { event: expect.objectContaining({ language: 'ar' }) },
    });
  });

  it('offers every language the site speaks', async () => {
    renderHostCreateWizard('en');
    await goToHostDetails();
    const choice = screen.getByLabelText(
      /^Language/,
    ) as unknown as HTMLSelectElement;
    expect([...choice.options].map((option) => option.value)).toEqual([
      'ar',
      'en',
      'fr',
    ]);
  });

  it('keeps the choice when the host steps back and forward again', async () => {
    renderHostCreateWizard('en');
    await goToHostDetails();
    fireEvent.change(screen.getByLabelText(/^Language/), {
      target: { value: 'ar' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      (screen.getByLabelText(/^Language/) as unknown as HTMLSelectElement)
        .value,
    ).toBe('ar');
  });
});
