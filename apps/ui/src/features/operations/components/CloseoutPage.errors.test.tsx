import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { LOCALES, sign_in, type Locale } from '@founders-coffee/i18n';

const state = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  save: {} as Record<string, unknown>,
  sent: [] as unknown[],
}));

vi.mock('../hooks', () => ({
  useCloseout: () => state.query,
  useSubmitCloseout: () => state.save,
  useFeedbackTally: () => ({ data: undefined }),
}));
vi.mock('../../events/hooks', () => ({
  useRepeatEventTemplate: () => ({ data: null }),
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({
    children,
    to,
    params,
    search,
  }: {
    children: ReactNode;
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
  }) => (
    <a
      href={`${Object.entries(params ?? {}).reduce(
        (path, [key, value]) => path.replace(`$${key}`, value),
        to,
      )}${search ? `?${new URLSearchParams(search).toString()}` : ''}`}
    >
      {children}
    </a>
  ),
}));

const { CloseoutPage } = await import('./CloseoutPage');

const view = (overrides: Record<string, unknown> = {}) => ({
  eventId: 'evt_1',
  outcome: null,
  version: 0,
  walkInCount: 0,
  roster: [
    { userId: 'usr_a', name: 'Amina', outcome: null },
    { userId: 'usr_b', name: 'Bilal', outcome: null },
  ],
  registeredAttended: 0,
  totalAttended: 0,
  ...overrides,
});

const show = (locale: Locale = 'en') =>
  render(<CloseoutPage locale={locale} eventId="evt_1" />);

beforeEach(() => {
  state.sent = [];
  state.query = {
    data: view(),
    isError: false,
    error: null,
    userId: 'usr_host',
    isAuthLoading: false,
    refetch: vi.fn(),
  };
  state.save = {
    mutate: (input: unknown) => state.sent.push(input),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    data: undefined,
  };
});

afterEach(() => cleanup());

describe('states the host can land in', () => {
  it('says a gathering already closed out is closed, rather than offering the form again', () => {
    state.query = {
      ...state.query,
      data: view({ outcome: 'held', version: 1 }),
    };

    show();

    expect(screen.getByRole('status').textContent).toMatch(
      /Already closed out/i,
    );
    expect(screen.queryByRole('button', { name: /Submit/i })).toBeNull();
  });

  it('names the refusal rather than showing a generic failure', () => {
    state.query = {
      ...state.query,
      data: undefined,
      isError: true,
      error: Object.assign(new Error('x'), { code: 'closeout_not_host' }),
    };
    show();

    expect(screen.getByRole('alert').textContent).toMatch(/Only the host/i);
  });

  it('shows nothing but the refusal where the market has operations off', () => {
    state.query = {
      ...state.query,
      data: undefined,
      isError: true,
      error: Object.assign(new Error('x'), { code: 'operations_disabled' }),
    };
    show();

    expect(screen.getByRole('alert').textContent).toMatch(
      /not available in your region/i,
    );
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.queryByRole('button', { name: /Submit/i })).toBeNull();
  });

  it('explains a legacy event that can never be closed out, and shows no form', () => {
    state.query = {
      ...state.query,
      data: undefined,
      isError: true,
      error: Object.assign(new Error('x'), { code: 'closeout_no_end_time' }),
    };
    show();

    expect(screen.getByRole('alert').textContent).toMatch(/no recorded end/i);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
  });

  it('says the attempts ran out rather than failing generically', () => {
    state.query = {
      ...state.query,
      data: undefined,
      isError: true,
      error: Object.assign(new Error('x'), { code: 'rate_limited' }),
    };
    show();

    expect(screen.getByRole('alert').textContent).toMatch(
      /Wait a few minutes/i,
    );
  });

  it('explains a gathering that has not finished', () => {
    state.query = {
      ...state.query,
      data: undefined,
      isError: true,
      error: Object.assign(new Error('x'), { code: 'closeout_not_ended' }),
    };
    show();

    expect(screen.getByRole('alert').textContent).toMatch(/not finished/i);
  });

  it('explains a gathering the host called off, and shows no form to fill in', () => {
    state.query = {
      ...state.query,
      data: undefined,
      isError: true,
      error: Object.assign(new Error('x'), {
        code: 'closeout_event_cancelled',
      }),
    };
    show();

    expect(screen.getByRole('alert').textContent).toMatch(/cancelled/i);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.queryByRole('button', { name: /Submit/i })).toBeNull();
  });

  it('says plainly when some names could not be recorded', () => {
    state.save = {
      ...state.save,
      isSuccess: true,
      data: { refusedMarks: ['usr_b'] },
    };
    show();

    expect(screen.getByRole('alert').textContent).toMatch(
      /could not be recorded/i,
    );
  });

  it('offers sign-in to an anonymous visitor', () => {
    state.query = { ...state.query, userId: undefined, isAuthLoading: false };
    show();

    expect(
      screen.getByRole('link', { name: sign_in({}, { locale: 'en' }) }),
    ).toBeTruthy();
  });

  it.each<Locale>([...LOCALES])(
    'brings a host who signs in again back to this closeout, in %s',
    (locale) => {
      state.query = { ...state.query, userId: undefined, isAuthLoading: false };
      show(locale);

      const signIn = screen.getByRole('link', {
        name: sign_in({}, { locale }),
      });
      expect(
        new URL(
          signIn.getAttribute('href') ?? '',
          'http://localhost',
        ).searchParams.get('redirect'),
        'an unprefixed return path goes through the legacy /closeout stub, which takes its language from the cookie at that moment rather than from the link the host was reading',
      ).toBe(`/${locale}/closeout/evt_1`);
    },
  );

  it('renders in the host’s language', () => {
    show('ar');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'كيف سار اللقاء؟',
    );
  });
});
