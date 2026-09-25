import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { AppError } from '@founders-coffee/core';

import type { DeviceList } from '../api';

const state = vi.hoisted(() => ({
  devices: undefined as { data?: DeviceList } | undefined,
  revoke: vi.fn(),
  unlink: vi.fn(),
}));

vi.mock('../hooks', () => ({
  useMyDevices: () => state.devices ?? {},
  useRevokeDevice: () => ({ mutateAsync: state.revoke, isPending: false }),
  useUnlinkProvider: () => ({ mutateAsync: state.unlink, isPending: false }),
}));

const { DevicePanel } = await import('./DevicePanel');

const devices = (overrides: Partial<DeviceList> = {}): DeviceList => ({
  sessions: [
    { id: 'ses_1', isCurrent: true, userAgent: 'Firefox', startedAt: 1 },
    { id: 'ses_2', isCurrent: false, userAgent: 'Old phone', startedAt: 2 },
  ],
  providers: ['google'],
  ...overrides,
});

const show = (data?: DeviceList) => {
  state.devices = data ? { data } : {};
  return render(<DevicePanel locale="en" />);
};

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
});

describe('the devices panel', () => {
  it('shows nothing at all until the devices are known', () => {
    const { container } = show(undefined);

    expect(container.textContent).toBe('');
  });

  it('marks the device being used and offers it no sign-out', () => {
    show(devices());

    expect(screen.getByText('This device')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Sign out' })).toHaveLength(1);
  });

  it('signs out one named device', async () => {
    show(devices());

    fireEvent.click(screen.getByRole('button', { name: 'Sign out' }));

    await waitFor(() =>
      expect(state.revoke).toHaveBeenCalledWith({ sessionId: 'ses_2' }),
    );
  });

  it('signs out every other device in one action', async () => {
    show(devices());

    fireEvent.click(
      screen.getByRole('button', { name: 'Sign out other devices' }),
    );

    await waitFor(() =>
      expect(state.revoke).toHaveBeenCalledWith({ othersOnly: true }),
    );
  });

  it('says so plainly when this is the only device', () => {
    show(
      devices({
        sessions: [
          { id: 'ses_1', isCurrent: true, userAgent: 'Firefox', startedAt: 1 },
        ],
      }),
    );

    expect(screen.getByText('No other device is signed in.')).toBeTruthy();
    expect(
      screen.queryByRole('button', { name: 'Sign out other devices' }),
    ).toBeNull();
  });

  it('names a device it cannot recognise rather than leaving the row blank', () => {
    show(
      devices({
        sessions: [
          { id: 'ses_9', isCurrent: false, userAgent: null, startedAt: 1 },
        ],
      }),
    );

    expect(screen.getByText('Unrecognised device')).toBeTruthy();
  });

  it('warns that signing out also stops that device notifying', () => {
    show(devices());

    expect(
      screen.getByText('Signing a device out also stops its notifications.'),
    ).toBeTruthy();
  });

  it('unlinks a sign-in method', async () => {
    show(devices());

    fireEvent.click(screen.getByRole('button', { name: 'Unlink' }));

    await waitFor(() =>
      expect(state.unlink).toHaveBeenCalledWith({ providerId: 'google' }),
    );
  });

  it('explains a refusal to remove the last way in', async () => {
    state.unlink.mockRejectedValue(
      new AppError('last_sign_in_method', 'Keep one way to sign in'),
    );
    show(devices());

    fireEvent.click(screen.getByRole('button', { name: 'Unlink' }));

    await waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain(
        'only way to sign in',
      ),
    );
  });
});

const CHROME_ON_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/153.0.0.0 Safari/537.36';

describe('how a registered device is described', () => {
  it('names the browser and the machine, not the string the browser sends', () => {
    show(
      devices({
        sessions: [
          {
            id: 'ses_1',
            isCurrent: true,
            userAgent: CHROME_ON_MAC,
            startedAt: 1,
          },
        ],
      }),
    );

    expect(
      screen.queryByText(CHROME_ON_MAC),
      'this is the page someone opens to decide whether to sign something out, and it answered with the string a browser sends to a server',
    ).toBeNull();
    expect(screen.getByText('Chrome on macOS')).toBeTruthy();
  });

  it('still says something about a device it cannot place', () => {
    show(
      devices({
        sessions: [
          {
            id: 'ses_1',
            isCurrent: true,
            userAgent: 'curl/8.4.0',
            startedAt: 1,
          },
        ],
      }),
    );

    expect(screen.getByText('Unrecognised device')).toBeTruthy();
  });
});
