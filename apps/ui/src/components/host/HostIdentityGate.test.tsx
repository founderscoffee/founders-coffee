import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  sent: [] as unknown[],
  onCancel: vi.fn(),
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

vi.mock('../../lib/app-providers', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));

vi.mock('../company/LegalNotice', () => ({
  LegalNotice: () => <p data-testid="legal-notice" />,
}));

vi.mock('../../features/profile/components/ProfileCompletion', () => ({
  ProfileCompletion: () => <p data-testid="profile-completion" />,
}));

vi.mock('@founders-coffee/ui', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Turnstile: ({ onToken }: { onToken: (token: string) => void }) => (
    <button type="button" onClick={() => onToken('captcha-token')}>
      Solve captcha
    </button>
  ),
}));

const { HostIdentityGate } = await import('./HostIdentityGate');

const show = ({ isTurnstileBypassed }: { isTurnstileBypassed: boolean }) =>
  render(
    <HostIdentityGate
      locale="en"
      turnstileSiteKey="site-key"
      isTurnstileBypassed={isTurnstileBypassed}
      socialProviders={[]}
      needsReauthentication={false}
      onCancel={state.onCancel}
      onAuthenticated={() => undefined}
    />,
  );

const sendCodeTo = async (email: string) => {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: email },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Send code' }));
  await act(async () => {
    await Promise.resolve();
  });
};

beforeEach(() => {
  state.sent = [];
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  Reflect.deleteProperty(navigator, 'credentials');
});

describe('the sign-in gate in the host wizard', () => {
  it('titles the panel above its form, where the wizard has always shown it', () => {
    show({ isTurnstileBypassed: false });

    const title = screen.getByRole('heading', {
      level: 3,
      name: 'Sign in to publish',
    });

    expect(title.closest('form')).toBeNull();
    expect(title.nextElementSibling).toBe(
      screen.getByLabelText('Email').closest('form'),
    );
  });

  it('says an address without an account gets one, with no hint under the field', () => {
    show({ isTurnstileBypassed: false });

    expect(
      screen.getByText(
        "If you don't have an account, we'll create one for you automatically.",
      ),
    ).toBeTruthy();
    expect(
      screen.getByLabelText('Email').getAttribute('aria-describedby'),
    ).toBeNull();
  });

  it('sends no code until the challenge has answered', () => {
    show({ isTurnstileBypassed: false });
    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'host@example.com' },
    });
    const send = screen.getByRole('button', {
      name: 'Send code',
    }) as HTMLButtonElement;

    expect(send.disabled).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: 'Solve captcha' }));
    expect(send.disabled).toBe(false);
  });

  it('shows no challenge where local development bypasses it, and sends straight away', async () => {
    show({ isTurnstileBypassed: true });

    expect(screen.queryByRole('button', { name: 'Solve captcha' })).toBeNull();
    await sendCodeTo('host@example.com');

    expect(state.sent).toEqual([
      { email: 'host@example.com', type: 'sign-in' },
    ]);
    expect(screen.getByLabelText('Enter the code')).toBeTruthy();
  });

  it('sends the code again once the wait is over, with no challenge to wait for under the bypass', async () => {
    vi.useFakeTimers();
    show({ isTurnstileBypassed: true });
    await sendCodeTo('host@example.com');

    await act(async () => {
      vi.advanceTimersByTime(30_000);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Resend code' }));
    await act(async () => {
      await Promise.resolve();
    });

    expect(state.sent).toHaveLength(2);
  });

  it('fills the code in when the browser reads it from the message', async () => {
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: { get: () => Promise.resolve({ code: '482915' }) },
    });
    show({ isTurnstileBypassed: true });
    await sendCodeTo('host@example.com');

    await waitFor(() =>
      expect(
        (screen.getByLabelText('Enter the code') as HTMLInputElement).value,
      ).toBe('482915'),
    );
  });

  it('goes back to the draft from the code step too', async () => {
    show({ isTurnstileBypassed: true });
    await sendCodeTo('host@example.com');

    fireEvent.click(screen.getByRole('button', { name: 'Back to the form' }));

    expect(state.onCancel).toHaveBeenCalledOnce();
  });
});
