import { cleanup, fireEvent, render, screen } from '@testing-library/react';
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

describe('the preferences screen', () => {
  it('offers every category the member can turn off', () => {
    show({ data: view() });

    expect(
      (
        screen.getByRole('switch', {
          name: /Reminders before a gathering/i,
        }) as HTMLInputElement
      ).checked,
    ).toBe(true);
    expect(
      (
        screen.getByRole('switch', {
          name: /After a gathering/i,
        }) as HTMLInputElement
      ).checked,
    ).toBe(false);
  });

  it('says event details stay in the app whatever is switched off', () => {
    show({ data: view() });

    expect(screen.getByText(/Event details stay in the app/i)).toBeTruthy();
  });

  it('sends the revision it was shown, so a stale form is refused', () => {
    show({ data: view({ revision: 7 }) });

    fireEvent.click(
      screen.getByRole('switch', { name: /Reminders before a gathering/i }),
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
    const reminders = screen.getByRole('switch', {
      name: /Reminders before a gathering/i,
    });

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
  });

  it('offers sign-in to an anonymous visitor', () => {
    state.query = { userId: undefined, isAuthLoading: false };
    state.push = { state: 'not_requested', enable: vi.fn(), isEnabling: false };
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

    expect(screen.getByRole('status').textContent).toMatch(/another window/i);
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

    expect(screen.getByRole('status').textContent).toMatch(
      /Verify a phone number/i,
    );
  });
});

describe('in Arabic', () => {
  it('renders the screen in the member locale', () => {
    show({ data: view() }, { locale: 'ar' });

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'التفضيلات',
    );
  });
});
