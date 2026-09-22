import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  account_data_request,
  LOCALES,
  type Locale,
} from '@founders-coffee/i18n';

import { CONTACT_EMAIL } from '../../../content/company/contact';

import type { AccountSummary } from '../api';

const state = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  updateLocale: {} as Record<string, unknown>,
}));

vi.mock('../hooks', () => ({
  useMyAccount: () => state.query,
  useMyDevices: () => ({ data: undefined }),
  useRevokeDevice: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUnlinkProvider: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateAccountLocale: () => state.updateLocale,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock('../../profile/components/ProfileAccess', () => ({
  ProfileAccess: () => <div data-testid="access-recovery" />,
}));
vi.mock('../contact-hooks', () => {
  const idle = () => ({ mutateAsync: vi.fn(), isPending: false });
  return {
    useSendEmailChangeCode: idle,
    useRequestEmailChange: idle,
    useConfirmEmailChange: idle,
    useSendPhoneCode: idle,
    useConfirmPhoneNumber: idle,
  };
});

const { AccountPage } = await import('./AccountPage');

const summary = (overrides: Partial<AccountSummary> = {}): AccountSummary => ({
  userId: 'usr_1',
  locale: null,
  email: { masked: 'am•••@example.dz', verified: true },
  phone: { masked: null, verified: false },
  providers: ['google'],
  sessionCount: 2,
  ...overrides,
});

const show = (query: Record<string, unknown>, locale: Locale = 'en') => {
  state.query = { userId: 'usr_1', isAuthLoading: false, ...query };
  state.updateLocale = {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
  };
  return render(<AccountPage locale={locale} />);
};

afterEach(() => cleanup());

describe('the account and security screen', () => {
  it('states each fact without disclosing the identifier behind it', () => {
    show({
      data: summary({ phone: { masked: '+213 •••• 42', verified: true } }),
    });

    expect(screen.getByText('am•••@example.dz')).toBeTruthy();
    expect(screen.getByText('+213 •••• 42')).toBeTruthy();
    expect(screen.getByText('Google')).toBeTruthy();
    expect(screen.getByText('2 signed in right now')).toBeTruthy();
  });

  it('says a phone is missing in words rather than in dots', () => {
    show({ data: summary() });

    expect(screen.getByText('Not added')).toBeTruthy();
    expect(screen.queryByText('Verified')).toBeTruthy();
  });

  it('names a sign-in method rather than showing its identifier', () => {
    show({ data: summary({ providers: ['google', 'github'] }) });

    expect(screen.getByText('Google')).toBeTruthy();
    expect(screen.getByText('GitHub')).toBeTruthy();
  });

  it('explains an account signed in with no linked provider', () => {
    show({ data: summary({ providers: [] }) });

    expect(screen.getByText('Email code only')).toBeTruthy();
  });

  it('offers an action on every row, in the form that row supports', () => {
    show({ data: summary() });

    expect(screen.getByRole('button', { name: 'Change' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Add' })).toBeTruthy();
    expect(screen.getByText('Download your information')).toBeTruthy();
    expect(
      screen.getAllByRole('link', { name: CONTACT_EMAIL }),
      'the contact rows are changed in the product and the two data rights are exercised by email; both are actions, and the page used to offer the second pair none',
    ).toHaveLength(2);
  });

  it('opens the change dialog on the row that was pressed', () => {
    show({ data: summary() });

    fireEvent.click(screen.getByRole('button', { name: 'Add' }));

    expect(
      screen.getByRole('dialog', { name: 'Add a phone number' }),
    ).toBeTruthy();
  });

  it('asks an email change to prove the address already on file', () => {
    show({ data: summary() });

    fireEvent.click(screen.getByRole('button', { name: 'Change' }));
    const dialog = screen.getByRole('dialog', {
      name: 'Change your email address',
    });

    expect(dialog.textContent).toContain('confirm the address we already have');
    expect(dialog.textContent).toContain('keeps working until the new one');
  });

  it('offers a way out when the address on file is unreachable', () => {
    show({ data: summary() });
    fireEvent.click(screen.getByRole('button', { name: 'Change' }));

    expect(
      screen.getByRole('dialog', { name: 'Change your email address' })
        .textContent,
    ).toContain('contact us and we will verify you another way');
  });

  it('groups the rows the way the specification asks for', () => {
    show({ data: summary() });

    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map((node) => node.textContent),
    ).toEqual([
      'Interface language',
      'Private contacts',
      'Sign-in and devices',
      'Your data',
    ]);
  });

  it('keeps the interface language control on the account screen', () => {
    show({ data: summary({ locale: 'fr' }) });

    expect(
      (
        screen.getByRole('combobox', {
          name: 'Interface language',
        }) as unknown as HTMLSelectElement
      ).value,
    ).toBe('fr');
    expect(
      screen.getByText('Choose the language used across Founders Coffee.'),
    ).toBeTruthy();
  });

  it('keeps the heading stable while the account is still loading', () => {
    show({ isPending: true });

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Account & security',
    );
    expect(screen.getByRole('status').textContent).toBe(
      'Loading your account…',
    );
  });

  it('explains an unavailable account rather than showing an empty one', () => {
    show({ isError: true });

    expect(screen.getByRole('alert').textContent).toBe(
      'Your account details could not be loaded.',
    );
    expect(screen.queryByText('Private contacts')).toBeNull();
  });

  it('sends a signed-out visitor to the shared recovery screen', () => {
    show({ userId: undefined });

    expect(screen.getByTestId('access-recovery')).toBeTruthy();
  });

  it('reaches every section by keyboard, in reading order', () => {
    show({ data: summary() });
    const nav = screen.getByRole('navigation');
    const links = Array.from(nav.querySelectorAll('a'));

    for (const link of links) {
      link.focus();
      expect(document.activeElement).toBe(link);
      expect(link.getAttribute('tabindex')).not.toBe('-1');
    }
    expect(links.map((link) => link.textContent)).toEqual([
      'Profile',
      'My activity',
      'Notifications',
      'Account & security',
    ]);
  });

  it.each<Locale>(['ar', 'fr'])('renders the section nav in %s', (locale) => {
    show({ data: summary() }, locale);

    const nav = screen.getByRole('navigation');
    const links = Array.from(nav.querySelectorAll('a')).map((link) =>
      link.getAttribute('href'),
    );
    expect(links).toEqual([
      '/profile',
      '/profile/activity',
      '/profile/notifications',
      '/profile/account',
    ]);
  });
});

describe('what the data section offers', () => {
  it.each<Locale>([...LOCALES])(
    'gives each data right a way to be exercised, in %s',
    (locale) => {
      const view = show({ data: summary() }, locale);
      const requests = [
        ...view.container.querySelectorAll('a[href^="mailto:"]'),
      ];

      expect(
        requests.length,
        'the page named a right to a copy of your data and a right to close your account, then offered no next step for either, so the reader who came to do one of them stopped here',
      ).toBe(2);
      expect(
        requests.every((link) =>
          link.getAttribute('href')?.startsWith(`mailto:${CONTACT_EMAIL}`),
        ),
        'a request sent anywhere but the address the privacy policy documents is one nobody is watching for',
      ).toBe(true);
      expect(
        requests.every((link) => link.textContent?.includes(CONTACT_EMAIL)),
        'the address has to be readable on the row, because a phone with no mail client set up opens nothing',
      ).toBe(true);

      const subjects = requests.map(
        (link) => link.getAttribute('href')?.split('?subject=')[1] ?? '',
      );
      expect(
        new Set(subjects).size,
        'both rows opened the same message, so whoever reads the mailbox cannot tell a request for a copy from a request to close the account',
      ).toBe(2);
      expect(
        subjects.every((subject) => subject !== ''),
        'an unlabelled compose window asks the reader to write the request themselves, which is most of the dead end again',
      ).toBe(true);

      expect(
        view.container.textContent,
        'the policy only accepts a request sent from the address on the account, so a row that does not say so sends people from whichever mailbox is open',
      ).toContain(account_data_request({}, { locale }));
    },
  );
});
