import {
  CREATED_EVENT,
  fillHostDetails,
  getHostCreateMocks,
  goToHostDetails,
  renderHostCreateWizard,
  resetHostCreateFixtures,
} from './HostCreatePage.fixtures';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

const hostCreateMocks = getHostCreateMocks();

describe('HostCreatePage EC-07 state', () => {
  afterEach(resetHostCreateFixtures);

  it('retains schedule and details through back and forward navigation', async () => {
    renderHostCreateWizard();
    await goToHostDetails();
    fillHostDetails();
    fireEvent.change(screen.getByLabelText('Language'), {
      target: { value: 'fr' },
    });
    fireEvent.change(screen.getByLabelText('Category'), {
      target: { value: 'demo-day' },
    });

    fireEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(screen.getByRole('button', { name: 'Set schedule' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      (screen.getByLabelText(/^Title/) as unknown as HTMLInputElement).value,
    ).toBe('Protected meetup');
    expect(
      (screen.getByLabelText('Language') as unknown as HTMLSelectElement).value,
    ).toBe('fr');
    expect(
      (screen.getByLabelText('Category') as unknown as HTMLSelectElement).value,
    ).toBe('demo-day');
  });

  it('shows the unlimited capacity default in confirmation', async () => {
    renderHostCreateWizard();
    await goToHostDetails();
    fillHostDetails();
    expect(
      within(screen.getByTestId('host-summary')).getByText('Unlimited'),
    ).toBeTruthy();
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
    expect(action?.className).toContain('md:static');
  });
});
