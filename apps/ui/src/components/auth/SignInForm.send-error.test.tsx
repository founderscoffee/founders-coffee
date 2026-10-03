import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  login_send_error,
  rate_limited,
  type Locale,
} from '@founders-coffee/i18n';

const state = vi.hoisted(() => ({ status: 429 }));

vi.mock('../../lib/auth', () => ({
  authClient: {
    emailOtp: {
      sendVerificationOtp: () =>
        Promise.resolve({ error: { status: state.status, statusText: '' } }),
    },
    signIn: {
      emailOtp: () => Promise.resolve({ error: null }),
      social: () => Promise.resolve({ error: null }),
    },
  },
}));

vi.mock('../company/LegalNotice', () => ({
  LegalNotice: () => <p data-testid="legal-notice" />,
}));

const { LoginPage } = await import('./LoginPage');

const askForCode = (locale: Locale) => {
  render(
    <LoginPage
      locale={locale}
      turnstileSiteKey={null}
      isTurnstileBypassed
      socialProviders={[]}
      redirect="/"
    />,
  );
  const field = screen.getByRole('textbox');
  fireEvent.change(field, { target: { value: 'reader@example.com' } });
  fireEvent.submit(field.closest('form') as HTMLFormElement);
};

afterEach(() => cleanup());

describe('the sign-in card when no code was sent', () => {
  it.each(['ar', 'fr', 'en'] as const)(
    'says to wait a few minutes when too many codes were asked for (%s)',
    async (locale) => {
      state.status = 429;

      askForCode(locale);

      expect(
        await screen.findByText(rate_limited({}, { locale })),
      ).toBeTruthy();
    },
  );

  it('keeps the general message for any other failure', async () => {
    state.status = 503;

    askForCode('en');

    expect(
      await screen.findByText(login_send_error({}, { locale: 'en' })),
    ).toBeTruthy();
  });
});
