import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { type Locale } from '@founders-coffee/i18n';

const mocks = vi.hoisted(() => ({
  mutateAsync: vi.fn(),
  config: { turnstileSiteKey: 'site-key', isTurnstileBypassed: false } as {
    turnstileSiteKey: string | null;
    isTurnstileBypassed: boolean;
  },
}));

vi.mock('../hooks', () => ({
  useJoinWaitlist: () => ({
    mutateAsync: mocks.mutateAsync,
    isPending: false,
    isSuccess: false,
  }),
}));

vi.mock('../../auth/hooks', () => ({
  usePublicAuthConfig: () => ({ data: mocks.config }),
}));

vi.mock('@founders-coffee/ui', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  Turnstile: ({
    language,
    onToken,
  }: {
    language: string;
    onToken: (token: string) => void;
  }) => (
    <button
      data-testid="waitlist-turnstile"
      data-language={language}
      onClick={() => onToken('tok')}
    >
      verify
    </button>
  ),
}));

vi.mock('../../../components/company/LegalNotice', () => ({
  LegalNotice: () => null,
}));

import { WaitlistForm } from './WaitlistForm';

const renderForm = (locale: Locale = 'en') =>
  render(
    <WaitlistForm
      locale={locale}
      marketCode="DZ"
      cityCode="1"
      cityName="Algiers"
    />,
  );

const typeEmail = () =>
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: 'founder@example.dz' },
  });

describe('WaitlistForm bot protection (AR-06)', () => {
  afterEach(() => {
    cleanup();
    mocks.config = { turnstileSiteKey: 'site-key', isTurnstileBypassed: false };
    vi.clearAllMocks();
  });

  it('will not submit before a Turnstile response is obtained', () => {
    renderForm();
    typeEmail();

    const submit = screen
      .getByRole('textbox')
      .closest('form')
      ?.querySelector('button[type="submit"]');
    expect((submit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(screen.getByRole('textbox').closest('form') as Element);
    expect(mocks.mutateAsync).not.toHaveBeenCalled();
  });

  it('submits the token once verification completes', async () => {
    mocks.mutateAsync.mockResolvedValue({ status: 'joined' });
    renderForm();
    typeEmail();

    fireEvent.click(screen.getByTestId('waitlist-turnstile'));
    fireEvent.submit(screen.getByRole('textbox').closest('form') as Element);

    expect(mocks.mutateAsync).toHaveBeenCalledWith({
      data: {
        email: 'founder@example.dz',
        marketCode: 'DZ',
        cityCode: '1',
        locale: 'en',
        turnstileToken: 'tok',
      },
    });
  });

  it('submits without a token only when the deployment bypasses Turnstile', () => {
    mocks.config = { turnstileSiteKey: null, isTurnstileBypassed: true };
    mocks.mutateAsync.mockResolvedValue({ status: 'joined' });
    renderForm();
    typeEmail();

    expect(screen.queryByTestId('waitlist-turnstile')).toBeNull();
    fireEvent.submit(screen.getByRole('textbox').closest('form') as Element);
    expect(mocks.mutateAsync).toHaveBeenCalledTimes(1);
  });

  it.each(['ar', 'fr'] as const)(
    'challenges in %s, the locale the page is in rather than the browser\u2019s',
    (locale) => {
      renderForm(locale);

      expect(screen.getByTestId('waitlist-turnstile').dataset.language).toBe(
        locale,
      );
    },
  );
});
