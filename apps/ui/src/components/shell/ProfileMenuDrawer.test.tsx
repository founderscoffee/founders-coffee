import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const state = { pathname: '/' };

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => (
    <a href="/">{children}</a>
  ),
  useLocation: ({ select }: { select: (l: { pathname: string }) => string }) =>
    select({ pathname: state.pathname }),
}));

const { ProfileMenuDrawer } = await import('./ProfileMenuDrawer');

const at = (pathname: string) => {
  state.pathname = pathname;
  render(<ProfileMenuDrawer locale="ar" />);
  return screen.queryByRole('button');
};

afterEach(() => cleanup());

describe('where the profile drawer offers itself', () => {
  it.each([
    '/ar/profile',
    '/fr/profile',
    '/en/profile/activity',
    '/ar/profile/notifications',
    '/ar/profile/account',
    '/profile',
    '/profile/activity',
  ])('opens on %s', (pathname) => {
    expect(
      at(pathname),
      'every one of these addresses carries a language now, so a check that only knew how to spell /profile would never open the drawer on any of them',
    ).not.toBeNull();
  });

  it.each(['/', '/ar/algeria', '/ar/login', '/ar/profiles', '/u/usr_1'])(
    'stays out of the way on %s',
    (pathname) => {
      expect(at(pathname)).toBeNull();
    },
  );
});

describe('how the drawer announces itself once it is open', () => {
  it('is named by its own heading', () => {
    const opener = at('/ar/profile');
    expect(opener).not.toBeNull();
    fireEvent.click(opener as HTMLElement);

    expect(
      screen.getByRole('dialog', { name: 'أقسام الملف' }),
      'the drawer opens over the page and takes the reader out of it, so a screen reader announcing only "dialog" leaves them with no idea where they now are',
    ).toBeTruthy();
  });
});
