import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { login_social_error } from '@founders-coffee/i18n';

type SocialResult = { error: { status: number; statusText: string } | null };

const social = vi.hoisted(() =>
  vi.fn<() => Promise<SocialResult>>(() => Promise.resolve({ error: null })),
);

vi.mock('../../lib/auth', () => ({
  authClient: {
    emailOtp: {
      sendVerificationOtp: () => Promise.resolve({ error: null }),
    },
    signIn: {
      emailOtp: () => Promise.resolve({ error: null }),
      social,
    },
  },
}));

vi.mock('../company/LegalNotice', () => ({
  LegalNotice: () => <p data-testid="legal-notice" />,
}));

const { LoginPage } = await import('./LoginPage');

const REFUSED: SocialResult = {
  error: { status: 403, statusText: 'Forbidden' },
};

const pressGoogle = () =>
  fireEvent.click(screen.getByRole('button', { name: /Google/ }));

afterEach(() => {
  cleanup();
  social.mockReset();
});

describe('a Google or GitHub sign-in that is refused', () => {
  it('tells the reader, in their language, instead of doing nothing', async () => {
    social.mockResolvedValue(REFUSED);
    render(
      <LoginPage
        locale="ar"
        turnstileSiteKey={null}
        isTurnstileBypassed
        socialProviders={['google']}
        redirect="/ar/algeria"
      />,
    );

    pressGoogle();

    expect(
      (await screen.findByRole('alert')).textContent,
      'a refused sign-in used to leave the button doing nothing, and a reader pressed it three times before giving up on it',
    ).toBe(login_social_error({ provider: 'Google' }, { locale: 'ar' }));
  });

  it('clears the message when the reader tries again', async () => {
    social.mockResolvedValueOnce(REFUSED);
    social.mockResolvedValueOnce({ error: null });
    render(
      <LoginPage
        locale="en"
        turnstileSiteKey={null}
        isTurnstileBypassed
        socialProviders={['google']}
        redirect="/en/algeria"
      />,
    );

    pressGoogle();
    await screen.findByRole('alert');
    pressGoogle();

    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(social).toHaveBeenCalledTimes(2);
  });
});
