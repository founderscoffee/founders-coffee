import {
  CREATED_EVENT,
  getHostCreateMocks,
  publishHostEvent,
  renderHostCreateWizard,
  resetHostCreateFixtures,
} from './HostCreatePage.fixtures';
import { screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

const hostCreateMocks = getHostCreateMocks();

const failPublishWith = (code: string) =>
  hostCreateMocks.mutateAsync.mockRejectedValue({
    code,
    message: `server said ${code}`,
  });

const draftKey = 'fc:event-draft:DZ';

describe('HostCreatePage EC-08 outcomes', () => {
  afterEach(resetHostCreateFixtures);

  it('opens the created event on its canonical route and refreshes the views it changed', async () => {
    renderHostCreateWizard();
    await publishHostEvent();

    await waitFor(() =>
      expect(hostCreateMocks.navigate).toHaveBeenCalledWith({
        to: '/$locale/$market/e/$slug',
        params: { locale: 'en', market: 'algeria', slug: CREATED_EVENT.slug },
      }),
    );
    expect(hostCreateMocks.invalidateCreatedEvent).toHaveBeenCalledWith({
      marketCode: CREATED_EVENT.marketCode,
      cityCode: CREATED_EVENT.cityCode,
      hostId: CREATED_EVENT.hostId,
      slug: CREATED_EVENT.slug,
    });
    expect(hostCreateMocks.routerInvalidate).toHaveBeenCalled();
    expect(window.sessionStorage.getItem(draftKey)).toBeNull();
  });

  it('never navigates away or drops the draft when the publish fails', async () => {
    failPublishWith('event_creation_disabled');
    renderHostCreateWizard();
    await publishHostEvent();

    await screen.findByText('Hosting is paused in this region right now.');
    expect(hostCreateMocks.navigate).not.toHaveBeenCalled();
    expect(hostCreateMocks.routerInvalidate).not.toHaveBeenCalled();
    expect(hostCreateMocks.invalidateCreatedEvent).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(draftKey)).toContain(
      'Protected meetup',
    );
  });

  it.each([
    [
      'rate_limited',
      'You have published several meetups recently. Wait a few minutes, then try again.',
    ],
    [
      'validation_failed',
      'Some details need attention. Review the steps and try again.',
    ],
    [
      'event_route_conflict',
      'Another meetup already uses this title. Change it slightly and publish.',
    ],
    ['map_venue_unsupported', 'Choose a café, restaurant, or coworking space'],
    ['forbidden', 'You cannot publish meetups with this account.'],
    [
      'security_configuration_error',
      'Publishing is temporarily unavailable. Try again shortly.',
    ],
    ['brand_new_server_code', "Couldn't publish. Try again."],
  ])('maps %s to an actionable message', async (code, message) => {
    failPublishWith(code);
    renderHostCreateWizard();
    await publishHostEvent();

    await screen.findByText(message);
  });

  it('keeps every entered value and stays publishable after a recoverable failure', async () => {
    failPublishWith('rate_limited');
    renderHostCreateWizard();
    await publishHostEvent();
    await screen.findByText(
      'You have published several meetups recently. Wait a few minutes, then try again.',
    );

    expect(
      (
        screen.getByRole('button', {
          name: 'Confirm and publish the meetup',
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(false);

    expect(
      (screen.getByLabelText(/^Meetup title/) as unknown as HTMLInputElement)
        .value,
    ).toBe('Protected meetup');
    expect(
      (
        screen.getByLabelText(
          /^Meetup description/,
        ) as unknown as HTMLTextAreaElement
      ).value,
    ).toBe('A complete protected meetup for founders.');
  });

  it('reopens the sign-in gate in place when the session expired, keeping the draft', async () => {
    failPublishWith('unauthenticated');
    window.history.replaceState({}, '', '/ar/algeria/host/create?city=1');
    renderHostCreateWizard();
    await publishHostEvent();

    await screen.findByRole('heading', {
      name: 'Sign in to publish',
    });
    expect(hostCreateMocks.navigate).not.toHaveBeenCalledWith(
      expect.objectContaining({ to: '/login' }),
    );
    await screen.findByText(
      'Your session expired. Sign in again to publish. Your draft is saved.',
    );
    const draft = window.sessionStorage.getItem(draftKey);
    expect(draft).toContain('Protected meetup');
    expect(draft).toContain('"step":3');
  });
});
