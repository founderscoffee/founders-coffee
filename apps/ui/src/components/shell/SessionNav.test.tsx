import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionNav } from './SessionNav';

const state = vi.hoisted(() => ({
  auth: {
    user: null as {
      id: string;
      name: string;
      email: string;
      role: string;
    } | null,
    isAuthenticated: false,
  },
  signOut: vi.fn(),
}));

vi.mock('../../lib/app-providers', () => ({ useAuth: () => state.auth }));
vi.mock('../../lib/auth', () => ({
  authClient: { signOut: state.signOut },
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const signedIn = (email = 'amina@example.dz') => {
  state.auth = {
    user: { id: 'usr_1', name: 'Amina Yagoub', email, role: 'member' },
    isAuthenticated: true,
  };
};

afterEach(() => {
  cleanup();
  state.auth = { user: null, isAuthenticated: false };
});

describe('session dropdown', () => {
  it('offers only a sign-in link to a visitor', () => {
    render(<SessionNav locale="en" />);

    expect(screen.getByRole('link').getAttribute('href')).toBe('/login');
    expect(screen.queryByText('Signed in as')).toBeNull();
  });

  it('names the account it is signed into, above the actions', () => {
    signedIn();
    const { container } = render(<SessionNav locale="en" />);

    expect(screen.getByText('Signed in as')).toBeTruthy();
    expect(screen.getByTitle('amina@example.dz').textContent).toBe(
      'amina@example.dz',
    );

    const order = Array.from(
      container.querySelectorAll('.dropdown-content > *'),
    ).map((node) => node.className.split(' ')[0]);
    expect(order[1]).toBe('truncate');
    expect(order[2]).toBe('divider');
    expect(order[3]).toBe('menu');
  });

  it('keeps a long address on one line for the layout to bound', () => {
    signedIn('a-very-long-address@an-unusually-long-domain.example.com');
    render(<SessionNav locale="en" />);

    const email = screen.getByTitle(
      'a-very-long-address@an-unusually-long-domain.example.com',
    );
    expect(email.className).toContain('truncate');
  });

  it('still reaches the profile and the sign-out action', () => {
    signedIn();
    render(<SessionNav locale="en" />);

    expect(
      screen.getByRole('link', { name: 'Your profile' }).getAttribute('href'),
    ).toBe('/profile');
    screen.getByRole('button', { name: 'Sign out' }).click();
    expect(state.signOut).toHaveBeenCalledOnce();
  });
});
