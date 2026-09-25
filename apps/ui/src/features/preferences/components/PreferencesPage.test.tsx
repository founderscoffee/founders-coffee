import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

import type { AccountPreferencesView } from '../api';

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
  revision: 3,
  preferences: {
    eventUpdates: true,
    eventUpdatesChannels: ['push', 'email'],
    eventReminders: true,
    eventRemindersChannels: ['push', 'email'],
    hostRsvpReceived: true,
    hostRsvpReceivedChannels: ['push', 'email'],
    hostRsvpCancelled: true,
    hostRsvpCancelledChannels: ['push', 'email'],
    followUpPrompts: false,
    followUpPromptsChannels: [],
    pushEnabled: false,
    smsFallbackEnabled: false,
  },
  smsAvailable: false,
  smsConsentAt: null,
  ...overrides,
});

const show = (
  query: Record<string, unknown>,
  options: { locale?: Locale } = {},
) => {
  state.query = { userId: 'usr_1', isAuthLoading: false, ...query };
  state.push = {
    state: 'registered',
    enable: vi.fn(async () => true),
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

describe('the preferences screen', () => {
  it('offers every category the member can turn off', () => {
    show({ data: view() });

    expect(
      (
        screen.getByRole('checkbox', {
          name: /Reminders before a gathering: Email/i,
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(
      (
        screen.getByRole('checkbox', {
          name: /After a gathering: Email/i,
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);
  });

  it('keeps interface language off the notification screen', () => {
    const { container } = show({ data: view() });

    expect(container.querySelector('#prefs-language')).toBeNull();
  });

  it('keeps delivery copy focused on push notifications', () => {
    show({ data: view() });

    expect(screen.getAllByText('Push notifications').length).toBeGreaterThan(0);
    expect(screen.queryByText(/Event details stay in the app/i)).toBeNull();
    expect(screen.queryByText(/How we reach you/i)).toBeNull();
    expect(screen.queryByText(/What we send you/i)).toBeNull();
  });

  it('sends the revision it was shown, so a stale form is refused', () => {
    show({ data: view({ revision: 7 }) });

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /Reminders before a gathering: Push notifications/i,
      }),
    );
    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /Reminders before a gathering: Email/i,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /Save preferences/i }));

    expect(state.saved).toEqual([
      expect.objectContaining({ expectedRevision: 7, eventReminders: false }),
    ]);
  });

  it('will not save until something changes', () => {
    show({ data: view() });

    expect(
      (
        screen.getByRole('button', {
          name: /Save preferences/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });

  it('discards back to what is saved', () => {
    show({ data: view() });
    const reminders = screen.getByRole('checkbox', {
      name: /Reminders before a gathering: Email/i,
    });

    fireEvent.click(
      screen.getByRole('checkbox', {
        name: /Reminders before a gathering: Push notifications/i,
      }),
    );
    fireEvent.click(reminders);
    fireEvent.click(screen.getByRole('button', { name: /Discard/i }));

    expect((reminders as HTMLInputElement).checked).toBe(true);
    expect(
      (
        screen.getByRole('button', {
          name: /Save preferences/i,
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
  });
});

describe('states the design spec requires', () => {
  it('shows a loading state without guessing the member', () => {
    show({ data: undefined, isPending: true, isError: false });

    expect(screen.getByRole('status').textContent).toMatch(/Loading/i);
  });

  it('explains an unavailable read rather than rendering an empty form', () => {
    show({ data: undefined, isError: true });

    expect(screen.getByRole('alert').textContent).toMatch(
      /could not be loaded/i,
    );
    expect(screen.getByRole('button', { name: /Try again/i })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Notifications' })).toBeTruthy();
  });

  it('offers sign-in to an anonymous visitor', () => {
    state.query = { userId: undefined, isAuthLoading: false };
    render(<PreferencesPage locale="en" markets={MARKETS} />);

    expect(screen.getByTestId('access-recovery')).toBeTruthy();
  });

  it('names the conflict when another window saved first', () => {
    state.save = {
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      isSuccess: false,
      error: Object.assign(new Error('conflict'), {
        code: 'preferences_conflict',
      }),
    };
    show({ data: view() });

    expect(screen.getByRole('alert').textContent).toMatch(/another window/i);
    expect(screen.getByRole('alert').className).toContain('alert-error');
  });

  it('names a refused consent instead of reporting a generic failure', () => {
    state.save = {
      mutate: vi.fn(),
      isPending: false,
      isError: true,
      isSuccess: false,
      error: Object.assign(new Error('no phone'), {
        code: 'sms_consent_unavailable',
      }),
    };
    show({ data: view() });

    expect(screen.getByRole('alert').textContent).toMatch(
      /Verify your phone number/i,
    );
  });

  it('confirms a save in a region that was already on the page', () => {
    const { rerender } = show({ data: view() });
    const regions = screen.getAllByRole('status');
    expect(regions.map((region) => region.textContent)).toEqual(['', '']);

    state.save = { ...state.save, isSuccess: true };
    rerender(<PreferencesPage locale="en" markets={MARKETS} />);

    const saved = screen
      .getAllByRole('status')
      .find((region) => region.textContent);
    expect(saved?.textContent).toMatch(/saved/i);
    expect(saved?.className).toContain('alert-success');
    expect(
      regions,
      'a polite region inserted with its text already in it is announced by some screen readers and not others',
    ).toContain(saved);
  });

  it('points out unsaved changes as information', () => {
    show({ data: view() });

    fireEvent.click(screen.getAllByRole('checkbox')[0] as HTMLElement);

    const unsaved = screen
      .getAllByRole('status')
      .find((region) => region.textContent);
    expect(unsaved?.className).toContain('alert-info');
    expect(screen.queryByRole('alert')?.textContent ?? '').toBe('');
  });
});

describe('in Arabic', () => {
  it('renders the screen in the member locale', () => {
    show({ data: view() }, { locale: 'ar' });

    expect(screen.getByRole('heading', { name: 'الإشعارات' })).toBeTruthy();
  });
});
