import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

import type { AccountPreferencesView } from '../api';
import type { PushState } from '../push-state';

const state = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  save: {} as Record<string, unknown>,
  push: {} as Record<string, unknown>,
  saved: [] as unknown[],
}));

vi.mock('../hooks', () => ({
  useMyPreferences: () => state.query,
  useSavePreferences: () => state.save,
  useDevicePushState: () => state.push,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock('../../profile/components/ProfileAccess', () => ({
  ProfileAccess: () => <div data-testid="access-recovery" />,
}));
vi.mock('../../account/components/ProfileSectionNav', () => ({
  ProfileSectionNav: () => <nav data-testid="section-nav" />,
}));

const { PreferencesPage } = await import('./PreferencesPage');

const MARKETS = [{ code: 'DZ', slug: 'algeria' }];

const view = (
  overrides: Partial<AccountPreferencesView> = {},
): AccountPreferencesView => ({
  locale: null,
  revision: 3,
  preferences: {
    eventUpdates: true,
    eventReminders: true,
    hostUpdates: true,
    followUpPrompts: false,
    pushEnabled: false,
    smsFallbackEnabled: false,
  },
  smsAvailable: false,
  smsConsentAt: null,
  ...overrides,
});

const show = (
  query: Record<string, unknown>,
  options: { locale?: Locale; push?: PushState } = {},
) => {
  state.query = { userId: 'usr_1', isAuthLoading: false, ...query };
  state.push = {
    state: options.push ?? 'not_requested',
    enable: vi.fn(),
    isEnabling: false,
    refresh: vi.fn(),
  };
  return render(
    <PreferencesPage locale={options.locale ?? 'en'} markets={MARKETS} />,
  );
};

beforeEach(() => {
  state.saved = [];
  state.save = {
    mutate: (input: unknown) => state.saved.push(input),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  };
});

afterEach(() => cleanup());

describe('the SMS fallback row tells the truth about consent', () => {
  it('is disabled and explains itself without a verified number', () => {
    show({ data: view({ smsAvailable: false }) });

    expect(
      (
        screen.getByRole('switch', {
          name: /Text message as a fallback/i,
        }) as HTMLInputElement
      ).disabled,
    ).toBe(true);
    expect(screen.getByText(/Verify a phone number in Account/i)).toBeTruthy();
  });

  it('points at the screen where a number is verified', () => {
    show({ data: view({ smsAvailable: false }) });

    expect(
      screen
        .getByRole('link', { name: /Account and security/i })
        .getAttribute('href'),
    ).toBe('/account');
  });

  it('can still be switched off after the number behind it is gone', () => {
    show({
      data: view({
        smsAvailable: false,
        preferences: { ...view().preferences, smsFallbackEnabled: true },
      }),
    });

    expect(
      (
        screen.getByRole('switch', {
          name: /Text message as a fallback/i,
        }) as HTMLInputElement
      ).disabled,
    ).toBe(false);
  });

  it('is settable once a number is verified', () => {
    show({ data: view({ smsAvailable: true }) });

    expect(
      (
        screen.getByRole('switch', {
          name: /Text message as a fallback/i,
        }) as HTMLInputElement
      ).disabled,
    ).toBe(false);
  });

  it('shows when consent was given, because it is evidence', () => {
    show({
      data: view({
        smsAvailable: true,
        smsConsentAt: '2026-03-05T10:00:00.000Z',
        preferences: { ...view().preferences, smsFallbackEnabled: true },
      }),
    });

    expect(screen.getByText(/You agreed to this on/i)).toBeTruthy();
  });
});

describe('the push row never claims what the browser decides', () => {
  it('offers no control at all when the browser cannot receive notifications', () => {
    show({ data: view() }, { push: 'unsupported' });

    expect(
      screen.getByText(/This browser cannot receive notifications/i),
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Turn on/i })).toBeNull();
  });

  it('sends a blocked member to their browser settings rather than a switch', () => {
    show({ data: view() }, { push: 'denied' });

    expect(screen.getByText(/Blocked in this browser/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Turn on/i })).toBeNull();
  });

  it('offers to ask only where asking would work', () => {
    show({ data: view() }, { push: 'not_requested' });

    expect(screen.getByRole('button', { name: /Turn on/i })).toBeTruthy();
  });

  it('separates a registered device from one that can still be reached', () => {
    show({ data: view() }, { push: 'delivery_unavailable' });

    expect(screen.getByText(/this device was signed out/i)).toBeTruthy();
  });

  it('says installation is needed where the prompt does not exist yet', () => {
    show({ data: view() }, { push: 'install_required' });

    expect(screen.getByText(/Add the app to your home screen/i)).toBeTruthy();
  });
});
