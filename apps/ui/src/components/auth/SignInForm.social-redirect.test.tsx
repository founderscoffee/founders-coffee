import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { brand, login_email_continue } from '@founders-coffee/i18n';

type SocialOptions = {
  provider: string;
  callbackURL: string;
  newUserCallbackURL?: string;
};

const social = vi.hoisted(() =>
  vi.fn<(options: SocialOptions) => Promise<{ error: null }>>(() =>
    Promise.resolve({ error: null }),
  ),
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
const { SignInForm } = await import('./SignInForm');

const MEETUP = '/ar/algeria/e/عندي-مشروع-في-وهران-ونحوس-على-مستثمرين';

const returnedTo = (address: string | undefined) => {
  const url = new URL(address ?? '');
  return { origin: url.origin, path: decodeURIComponent(url.pathname) };
};

const sentOptions = (): SocialOptions | undefined => social.mock.calls[0]?.[0];

afterEach(() => {
  cleanup();
  social.mockClear();
});

describe('a sign-in through Google or GitHub', () => {
  it('names the Arabic meetup it started from as a full address on this site', () => {
    render(
      <LoginPage
        locale="ar"
        turnstileSiteKey={null}
        isTurnstileBypassed
        socialProviders={['google']}
        redirect={MEETUP}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /Google/ }));

    expect(sentOptions()?.provider).toBe('google');
    expect(
      returnedTo(sentOptions()?.callbackURL),
      'Better Auth refuses a relative return path that is not plain ASCII, so every Google sign-in from an Arabic meetup page answered 403',
    ).toEqual({ origin: window.location.origin, path: MEETUP });
  });

  it('gives the host gate both of its return paths as full addresses', () => {
    render(
      <SignInForm
        locale="ar"
        turnstileSiteKey={null}
        isTurnstileBypassed
        socialProviders={['github']}
        layout="page"
        title={brand({}, { locale: 'ar' })}
        emailActionLabel={login_email_continue({}, { locale: 'ar' })}
        getSocialRedirect={() => ({
          callbackURL: encodeURI(MEETUP),
          newUserCallbackURL: encodeURI(MEETUP),
        })}
        onAuthenticated={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /GitHub/ }));

    expect(returnedTo(sentOptions()?.callbackURL)).toEqual({
      origin: window.location.origin,
      path: MEETUP,
    });
    expect(returnedTo(sentOptions()?.newUserCallbackURL)).toEqual({
      origin: window.location.origin,
      path: MEETUP,
    });
  });
});
