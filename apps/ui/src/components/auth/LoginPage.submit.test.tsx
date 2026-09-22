import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
});
