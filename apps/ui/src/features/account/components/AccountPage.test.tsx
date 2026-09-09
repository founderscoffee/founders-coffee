import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

import type { AccountSummary } from '../api';

const state = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
}));

vi.mock('../hooks', () => ({ useMyAccount: () => state.query }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
vi.mock('../../profile/components/ProfileAccess', () => ({
  ProfileAccess: () => <div data-testid="access-recovery" />,
}));

const { AccountPage } = await import('./AccountPage');

const summary = (overrides: Partial<AccountSummary> = {}): AccountSummary => ({
  userId: 'usr_1',
  email: { masked: 'am•••@example.dz', verified: true },
  phone: { masked: null, verified: false },
  providers: ['google'],
  sessionCount: 2,
  ...overrides,
});

const show = (query: Record<string, unknown>, locale: Locale = 'en') => {
  state.query = { userId: 'usr_1', isAuthLoading: false, ...query };
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

    expect(screen.getByText('Google · GitHub')).toBeTruthy();
  });

  it('explains an account signed in with no linked provider', () => {
    show({ data: summary({ providers: [] }) });

    expect(screen.getByText('Email code only')).toBeTruthy();
  });

  it('offers no action on a row whose capability has not shipped', () => {
    const { container } = show({ data: summary() });

    expect(container.querySelectorAll('button')).toHaveLength(0);
    expect(screen.getAllByText('Changes not available yet')).toHaveLength(6);
  });

  it('groups the rows the way the specification asks for', () => {
    show({ data: summary() });

    expect(
      screen
        .getAllByRole('heading', { level: 2 })
        .map((node) => node.textContent),
    ).toEqual(['Private contacts', 'Sign-in and devices', 'Your data']);
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

  it('reaches both sections by keyboard, in reading order', () => {
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
      'Account & security',
    ]);
  });

  it.each<Locale>(['ar', 'fr'])('renders the section nav in %s', (locale) => {
    show({ data: summary() }, locale);

    const nav = screen.getByRole('navigation');
    const links = Array.from(nav.querySelectorAll('a')).map((link) =>
      link.getAttribute('href'),
    );
    expect(links).toEqual(['/profile', '/account']);
  });
});
