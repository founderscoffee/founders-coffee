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

  it('submits the complete confirmed draft and reissues Turnstile after failure', async () => {
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
      target: { value: 'ar_en' },
    });
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'workshop' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(
      screen.getByRole('heading', { name: 'Review and confirm' }),
    ).toBeTruthy();
    expect(screen.getByText('12 Startup Street, Algiers')).toBeTruthy();
    expect(screen.getByText('Arabic and English')).toBeTruthy();
    expect(screen.getByText('Workshop')).toBeTruthy();

    const publish = screen.getByRole('button', {
      name: 'Confirm and publish',
    }) as HTMLButtonElement;
    expect(publish.disabled).toBe(true);
    fireEvent.click(
      screen.getByRole('button', { name: 'Complete verification' }),
    );
    fireEvent.click(publish);

    await waitFor(() =>
      expect(hostCreateMocks.mutateAsync).toHaveBeenCalledOnce(),
    );
    expect(hostCreateMocks.mutateAsync).toHaveBeenCalledWith({
      data: {
        event: expect.objectContaining({
          capacity: 24,
          language: 'ar_en',
          category: 'workshop',
        }),
        turnstileToken: 'single-use-token',
      },
    });
    await waitFor(() =>
      expect(
        screen.getByTestId('event-turnstile').getAttribute('data-reset-key'),
      ).toBe('1'),
    );
    expect(publish.disabled).toBe(true);
  });

  it('preserves an anonymous draft and hands off through a validated return path', async () => {
    hostCreateMocks.isAuthenticated = false;
    window.history.replaceState({}, '', '/algeria/host/create?city=1&state=16');
    renderHostCreateWizard();
    await goToHostDetails();
    fillHostDetails();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.queryByTestId('event-turnstile')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Continue to login' }));

    expect(hostCreateMocks.navigate).toHaveBeenCalledWith({
      to: '/login',
      search: {
        redirect: '/algeria/host/create?city=1&state=16',
      },
    });
    const stored = window.sessionStorage.getItem('fc:event-draft:DZ:1');
    expect(stored).toContain('Protected meetup');
    expect(stored).not.toContain('single-use-token');
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
    expect(screen.getByTestId('event-turnstile')).toBeTruthy();
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
