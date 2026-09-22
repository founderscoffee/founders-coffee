import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { type Locale } from '@founders-coffee/i18n';

const state = vi.hoisted(() => ({
  sent: [] as unknown[],
}));

vi.mock('../../lib/auth', () => ({
  authClient: {
    emailOtp: {
      sendVerificationOtp: (input: unknown) => {
        state.sent.push(input);
        return Promise.resolve({ error: null });
      },
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

vi.mock('@founders-coffee/ui', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Turnstile: ({ language }: { language: string }) => (
    <div data-testid="login-turnstile" data-language={language} />
  ),
}));

const { LoginPage } = await import('./LoginPage');

const show = () =>
  render(
    <LoginPage
      locale="en"
      turnstileSiteKey={null}
      isTurnstileBypassed
      hasSocial={false}
      redirect="/"
    />,
  );

const showChallenged = (locale: Locale) =>
  render(
    <LoginPage
      locale={locale}
      turnstileSiteKey="site-key"
      isTurnstileBypassed={false}
      hasSocial={false}
      redirect="/"
    />,
  );

beforeEach(() => {
  state.sent = [];
});

afterEach(() => cleanup());

describe('the sign-in card as a form', () => {
  it('keeps the email field and its submit control in one form', () => {
    show();

    const field = screen.getByRole('textbox');
    const form = field.closest('form');

    expect(form).not.toBeNull();
    expect(form?.querySelector('button[type="submit"]')).not.toBeNull();
  });

  it('asks for a code when the form is submitted, which is what Enter in the field does', () => {
    show();

    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: 'reader@example.com' } });
    fireEvent.submit(field.closest('form') as HTMLFormElement);

    expect(state.sent).toEqual([
      { email: 'reader@example.com', type: 'sign-in' },
    ]);
  });

  it('asks for nothing when the address is not one, so Enter cannot send a malformed request', () => {
    show();

    const field = screen.getByRole('textbox');
    fireEvent.change(field, { target: { value: 'reader@' } });
    fireEvent.submit(field.closest('form') as HTMLFormElement);

    expect(state.sent).toEqual([]);
  });

  it('leaves every other control out of submitting, so a provider button cannot send the form', () => {
    show();

    const form = screen.getByRole('textbox').closest('form') as HTMLFormElement;
    const others = [...form.querySelectorAll('button')].filter(
      (button) => button.type !== 'submit',
    );

    expect(others.every((button) => button.type === 'button')).toBe(true);
  });

  it('calls the email field Email, without reading the hint into its name', () => {
    show();

    const field = screen.getByLabelText('Email');

    expect(field.closest('label')).toBeNull();
    expect(
      document.getElementById(field.getAttribute('aria-describedby') ?? '')
        ?.textContent,
    ).toBe('We\u2019ll send a 6-digit code.');
  });
});

describe('the bot challenge on the sign-in card', () => {
  it.each(['ar', 'fr'] as const)(
    'challenges in %s, the locale the page is in rather than the browser\u2019s',
    (locale) => {
      showChallenged(locale);

      expect(screen.getByTestId('login-turnstile').dataset.language).toBe(
        locale,
      );
    },
  );
});
