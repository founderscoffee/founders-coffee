import { act, cleanup, render, screen } from '@testing-library/react';
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
    isLoading: false,
  },
  signOut: vi.fn(),
  profile: {
    data: null as { userId: string; photoAssetId: string | null } | null,
    isPending: false,
  },
  pathname: '/',
}));

vi.mock('../../features/profile/hooks', () => ({
  useMyProfile: () => state.profile,
}));
vi.mock('../../lib/app-providers', () => ({ useAuth: () => state.auth }));
vi.mock('../../lib/auth', () => ({
  authClient: { signOut: state.signOut },
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
    params?: Record<string, string>;
  }) => (
    <a
      href={Object.entries(params ?? {}).reduce(
        (path, [name, value]) => path.replace(`$${name}`, value),
        to,
      )}
      {...rest}
    >
      {children}
    </a>
  ),
  useLocation: ({ select }: { select: (l: { pathname: string }) => string }) =>
    select({ pathname: state.pathname }),
}));

const signedIn = (email = 'amina@example.dz') => {
  state.auth = {
    user: { id: 'usr_1', name: 'Amina Yagoub', email, role: 'member' },
    isAuthenticated: true,
    isLoading: false,
  };
};

afterEach(() => {
  cleanup();
  state.auth = { user: null, isAuthenticated: false, isLoading: false };
  state.profile = { data: null, isPending: false };
  state.pathname = '/';
  window.localStorage.clear();
  delete document.documentElement.dataset.authSlot;
});

const openDropdown = (container: HTMLElement) => {
  const details = container.querySelector('details') as HTMLDetailsElement;
  act(() => {
    details.open = true;
  });
  return details;
};

const pointerDownOn = (target: Node) =>
  act(() => {
    target.dispatchEvent(new Event('pointerdown', { bubbles: true }));
  });

describe('session dropdown', () => {
  it('offers only a sign-in link to a visitor', () => {
    render(<SessionNav locale="en" />);

    expect(screen.getByRole('link').getAttribute('href')).toBe('/en/login');
    expect(screen.queryByText('Signed in as')).toBeNull();
  });

  it('records what this browser needed, so the next load reserves the right width', () => {
    signedIn();
    render(<SessionNav locale="en" />);

    expect(window.localStorage.getItem('fc_auth_slot')).toBe('in');
    expect(
      document.documentElement.dataset.authSlot,
      'the pre-paint script sizes the slot from the stored value, and correcting the attribute here is what stops a wrong guess leaving a hole in the corner for the rest of the visit',
    ).toBe('in');
  });

  it('records the anonymous case too, rather than only the signed-in one', () => {
    render(<SessionNav locale="en" />);

    expect(window.localStorage.getItem('fc_auth_slot')).toBe('out');
    expect(document.documentElement.dataset.authSlot).toBe('out');
  });

  it.each(['/login', '/en/login', '/fr/login', '/ar/login'])(
    'does not offer sign-in to someone already on %s',
    (pathname) => {
      state.pathname = pathname;
      render(<SessionNav locale="en" />);

      expect(
        screen.queryByRole('link'),
        'the header pointed at the sign-in page from the sign-in page, so the one visible affordance on the page a signed-out reader lands on was a link back to where they already were',
      ).toBeNull();
    },
  );

  it('leaves the filled treatment to hosting', () => {
    render(<SessionNav locale="en" />);
    const className = screen.getByRole('link').className;

    expect(
      className,
      'sign-in wore btn-secondary, the clay accent, beside a host CTA in roast. Two filled buttons side by side, and the warmer one was the way back into an account you already have rather than the thing the product needs you to do',
    ).not.toContain('btn-secondary');
    expect(className).toContain('btn-ghost');
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

  it('gives each action an icon that the label already names', () => {
    signedIn();
    render(<SessionNav locale="en" />);

    for (const name of ['Your profile', 'Sign out']) {
      const icon = screen
        .getByText(name, { exact: false })
        .querySelector('svg');
      expect(icon).toBeTruthy();
      expect(icon?.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('mirrors the leaving arrow in a right-to-left reading order', () => {
    signedIn();
    const { container, rerender } = render(<SessionNav locale="en" />);
    const transformOf = () =>
      container.querySelector('button svg g')?.getAttribute('transform');

    expect(transformOf()).toBeNull();

    rerender(<SessionNav locale="ar" />);
    expect(transformOf()).toContain('scale(-1 1)');
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

describe('dismissing the session dropdown', () => {
  it('closes when an action inside it is chosen', () => {
    signedIn();
    const { container } = render(<SessionNav locale="en" />);
    const details = openDropdown(container);

    act(() => screen.getByRole('link', { name: 'Your profile' }).click());

    expect(details.open).toBe(false);
  });

  it('closes when the page behind it is touched', () => {
    signedIn();
    const { container } = render(<SessionNav locale="en" />);
    const details = openDropdown(container);

    pointerDownOn(document.body);

    expect(details.open).toBe(false);
  });

  it('stays open while the pointer lands inside it', () => {
    signedIn();
    const { container } = render(<SessionNav locale="en" />);
    const details = openDropdown(container);

    pointerDownOn(screen.getByTitle('amina@example.dz'));

    expect(details.open).toBe(true);
  });

  it('closes on Escape and hands focus back to the avatar', () => {
    signedIn();
    const { container } = render(<SessionNav locale="en" />);
    const details = openDropdown(container);

    act(() => {
      document.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
      );
    });

    expect(details.open).toBe(false);
    expect(document.activeElement).toBe(details.querySelector('summary'));
  });

  it('stops listening once it is gone from the page', () => {
    signedIn();
    const { container, unmount } = render(<SessionNav locale="en" />);
    openDropdown(container);
    unmount();

    expect(() => pointerDownOn(document.body)).not.toThrow();
  });
});
