import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { afterEach, assert, describe, expect, it, vi } from 'vitest';

import { profile_loading, type Locale } from '@founders-coffee/i18n';

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
    ...rest
  }: {
    children: React.ReactNode;
    to: string;
  }) => (
    <a href={to} {...rest}>
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

describe('session avatar', () => {
  it('updates after upload, replacement and removal without refreshing', () => {
    signedIn();
    const { container, rerender } = render(<SessionNav locale="en" />);
    expect(container.querySelector('summary')?.textContent).toBe('AY');
    for (const photoAssetId of ['pha_first', 'pha_replaced']) {
      state.profile.data = { userId: 'usr_1', photoAssetId };
      rerender(<SessionNav locale="en" />);
      expect(container.querySelector('summary img')?.getAttribute('src')).toBe(
        `/media/profile/${photoAssetId}/sm`,
      );
    }
    state.profile.data = { userId: 'usr_1', photoAssetId: null };
    rerender(<SessionNav locale="en" />);
    expect(container.querySelector('summary img')).toBeNull();
    expect(container.querySelector('summary')?.textContent).toBe('AY');
  });

  it('keeps a skeleton while the signed-in profile loads', () => {
    signedIn();
    state.profile.isPending = true;
    const { container } = render(<SessionNav locale="en" />);
    expect(screen.getByRole('status')).toBeTruthy();
    expect(container.querySelector('summary')).toBeNull();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('never renders an avatar belonging to the previous account', () => {
    signedIn();
    state.profile.data = { userId: 'usr_other', photoAssetId: 'pha_other' };
    const { container } = render(<SessionNav locale="en" />);
    expect(container.querySelector('summary img')).toBeNull();
  });

  it('falls back on delivery failure and tries a newly uploaded asset', () => {
    signedIn();
    state.profile.data = { userId: 'usr_1', photoAssetId: 'pha_failed' };
    const { container, rerender } = render(<SessionNav locale="en" />);
    const image = container.querySelector('img');
    assert(image);
    fireEvent.error(image);
    expect(container.querySelector('summary')?.textContent).toBe('AY');
    state.profile.data.photoAssetId = 'pha_new';
    rerender(<SessionNav locale="en" />);
    expect(container.querySelector('img')?.getAttribute('src')).toBe(
      '/media/profile/pha_new/sm',
    );
  });
});

describe('what the session menu offers', () => {
  it('reaches the activity page from behind the avatar', () => {
    signedIn();
    const { container } = render(<SessionNav locale="en" />);

    const targets = Array.from(container.querySelectorAll('a')).map((link) =>
      link.getAttribute('href'),
    );

    expect(
      targets,
      'this is the only entry point left since the footer dropped it, and a signed-in destination belongs where only a signed-in reader sees it',
    ).toContain('/profile/activity');
  });

  it('offers nothing behind an avatar nobody is signed in to', () => {
    const { container } = render(<SessionNav locale="en" />);

    expect(container.querySelector('a')?.getAttribute('href')).toBe('/login');
    expect(container.querySelector('details')).toBeNull();
  });
});

describe('session loading', () => {
  it('renders a skeleton rather than a login link before hydration', () => {
    const html = renderToString(<SessionNav locale="en" />);

    expect(html).toContain('skeleton');
    expect(
      html,
      'public documents go out as public, s-maxage=60, stale-while-revalidate=300, so whatever this renders on the server is handed to every reader the shared cache serves for the next minute. A signed-in header cached from one visitor and replayed to the next is worse than a placeholder, which is why the session is resolved in the browser and this stays empty until it is',
    ).not.toContain('href="/login"');
    expect(html).not.toContain('<details');
  });

  it.each<Locale>(['ar', 'fr', 'en'])(
    'keeps the skeleton until the session resolves in %s',
    (locale) => {
      state.auth.isLoading = true;
      const { container, rerender } = render(<SessionNav locale={locale} />);

      expect(screen.getByRole('status').textContent).toBe(
        profile_loading({}, { locale }),
      );
      expect(container.querySelector('.skeleton')?.className).toContain(
        'motion-reduce:animate-none',
      );
      expect(screen.queryByRole('link')).toBeNull();
      expect(container.querySelector('details')).toBeNull();

      signedIn();
      rerender(<SessionNav locale={locale} />);

      expect(screen.queryByRole('status')).toBeNull();
      expect(container.querySelector('summary')?.textContent).toBe('AY');
      expect(container.querySelector('a[href="/login"]')).toBeNull();
    },
  );

  it.each<Locale>(['ar', 'fr', 'en'])(
    'shows login only after the session resolves as signed out in %s',
    (locale) => {
      state.auth.isLoading = true;
      const { rerender } = render(<SessionNav locale={locale} />);
      expect(screen.queryByRole('link')).toBeNull();

      state.auth.isLoading = false;
      rerender(<SessionNav locale={locale} />);

      expect(screen.queryByRole('status')).toBeNull();
      expect(screen.getByRole('link').getAttribute('href')).toBe('/login');
    },
  );
});
