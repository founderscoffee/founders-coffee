import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  isAuthenticated: false,
  saved: [] as string[],
  navigated: [] as string[],
}));

vi.mock('../../lib/app-providers', () => ({
  useAuth: () => ({ isAuthenticated: state.isAuthenticated }),
}));
vi.mock('../../features/account/hooks', () => ({
  useUpdateAccountLocale: () => ({
    mutateAsync: (locale: string) => {
      state.saved.push(locale);
      return Promise.resolve();
    },
  }),
}));

const { LocaleToggle } = await import('./LocaleToggle');

beforeEach(() => {
  state.isAuthenticated = false;
  state.saved = [];
  state.navigated = [];
  document.cookie = 'paraglide_locale=; path=/; max-age=0';
});

afterEach(cleanup);

const pickFrench = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'FR' }));
  await vi.waitFor(() => expect(document.cookie).toContain('fr'));
};

describe('choosing a language from the footer', () => {
  it('saves the choice to the account of a member who is signed in', async () => {
    state.isAuthenticated = true;
    render(<LocaleToggle locale="ar" />);

    await pickFrench();

    expect(
      state.saved,
      'useStoredLocale reconciles this device against user.localePref on every page, so a change written only to the cookie is reverted by the next render rather than merely forgotten',
    ).toEqual(['fr']);
  });

  it('asks nothing of the server for a reader who is not signed in', async () => {
    render(<LocaleToggle locale="ar" />);

    await pickFrench();

    expect(state.saved).toEqual([]);
    expect(document.cookie).toContain('fr');
  });
});
