import {
  CREATED_EVENT,
  fillHostDetails,
  getHostCreateMocks,
  goToHostDetails,
  renderHostCreateWizard,
  resetHostCreateFixtures,
} from './HostCreatePage.fixtures';
import { fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

const hostCreateMocks = getHostCreateMocks();

describe('HostCreatePage EC-07 state', () => {
  afterEach(resetHostCreateFixtures);

  it('retains schedule and details through back and forward navigation', async () => {
    renderHostCreateWizard();
    await goToHostDetails();
    fillHostDetails();

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'Set schedule' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      (screen.getByLabelText(/^Title/) as unknown as HTMLInputElement).value,
    ).toBe('Protected meetup');
    expect(
      (screen.getByLabelText(/^Description/) as unknown as HTMLTextAreaElement)
        .value,
    ).toBe('A complete protected meetup for founders.');
  });

  it('keeps the stepper and the map in place, and stops the map selecting after step 1', async () => {
    renderHostCreateWizard();
    const progress = () => screen.getByLabelText('Event creation progress');
    const map = () => screen.getByTestId('host-map');

    expect(progress()).toBeTruthy();
    expect(map().getAttribute('data-interactive')).toBe('true');

    fireEvent.click(
      await screen.findByRole('button', { name: 'Choose venue' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(progress()).toBeTruthy();
    expect(map().getAttribute('data-interactive')).toBe('false');
  });

  it('locks duplicate submission while the first request is pending', async () => {
    let resolveMutation: (() => void) | undefined;
    hostCreateMocks.mutateAsync.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveMutation = () => resolve(CREATED_EVENT);
        }),
    );
    renderHostCreateWizard();
    await goToHostDetails();
    fillHostDetails();
    const publish = screen.getByRole('button', {
      name: 'Confirm and publish',
    }) as HTMLButtonElement;
    fireEvent.click(publish);
    fireEvent.click(publish);

    expect(hostCreateMocks.mutateAsync).toHaveBeenCalledOnce();
    expect(publish.disabled).toBe(true);
    expect(screen.getByText('Publishing…')).toBeTruthy();
    resolveMutation?.();
    await waitFor(() => expect(hostCreateMocks.navigate).toHaveBeenCalled());
  });

  it('uses a sticky, safe-area action region on the steps that scroll', async () => {
    renderHostCreateWizard();
    fireEvent.click(
      await screen.findByRole('button', { name: 'Choose venue' }),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    const action = screen.getByRole('button', { name: 'Next' }).parentElement
      ?.parentElement;
    expect(action?.className).toContain('sticky');
    expect(action?.className).toContain('safe-area-inset-bottom');
    expect(action?.className).toContain('lg:static');
  });
});
