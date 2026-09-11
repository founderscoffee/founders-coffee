import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

const state = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  save: {} as Record<string, unknown>,
  sent: [] as unknown[],
}));

vi.mock('../hooks', () => ({
  useCloseout: () => state.query,
  useSubmitCloseout: () => state.save,
}));
vi.mock('../../profile/components/ProfileAccess', () => ({
  ProfileAccess: () => <div data-testid="access-recovery" />,
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

describe('closing a gathering out', () => {
  it('will not submit until the host says whether it happened', () => {
    show();

    expect(
      (screen.getByRole('button', { name: /Submit/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('shows the roster only once the gathering is said to have happened', () => {
    show();
    expect(screen.queryByText('Amina')).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: /It happened/i }));

    expect(screen.getByText('Amina')).toBeTruthy();
    expect(screen.getByText('Bilal')).toBeTruthy();
  });

  it('shows the totals it is about to record, before recording them', () => {
    show();
    fireEvent.click(screen.getByRole('radio', { name: /It happened/i }));

    fireEvent.click(screen.getAllByRole('radio', { name: /^Came$/i })[0]!);

    expect(screen.getByText(/1 of the people who said/i)).toBeTruthy();
    expect(screen.getByText(/1 in the room altogether/i)).toBeTruthy();
  });

  it('adds walk-ins to the room but not to the registered count', () => {
    show();
    fireEvent.click(screen.getByRole('radio', { name: /It happened/i }));
    fireEvent.click(screen.getAllByRole('radio', { name: /^Came$/i })[0]!);
    fireEvent.change(screen.getByLabelText(/without saying so/i), {
      target: { value: '2' },
    });

    expect(screen.getByText(/1 of the people who said/i)).toBeTruthy();
    expect(screen.getByText(/3 in the room altogether/i)).toBeTruthy();
  });

  it('sends the marks alongside the outcome', () => {
    show();
    fireEvent.click(screen.getByRole('radio', { name: /It happened/i }));
    fireEvent.click(screen.getAllByRole('radio', { name: /^Came$/i })[0]!);
    fireEvent.click(screen.getByRole('button', { name: /Submit/i }));

    expect(state.sent).toEqual([
      expect.objectContaining({
        attendance: [{ userId: 'usr_a', outcome: 'attended' }],
      }),
    ]);
  });

  it('asks for a note before accepting “something else”', () => {
    show();
    fireEvent.click(screen.getByRole('radio', { name: /It happened/i }));
    fireEvent.click(screen.getByRole('checkbox', { name: /Something else/i }));

    expect(
      (screen.getByRole('button', { name: /Submit/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    fireEvent.change(screen.getByLabelText(/Tell us what else/i), {
      target: { value: 'the café closed' },
    });

    expect(
      (screen.getByRole('button', { name: /Submit/i }) as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it('hides the roster entirely when the gathering did not happen', () => {
    show();
    fireEvent.click(screen.getByRole('radio', { name: /It did not happen/i }));

    expect(screen.queryByText('Amina')).toBeNull();
    expect(screen.queryByLabelText(/without saying so/i)).toBeNull();
  });
});

describe('states the host can land in', () => {
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

    expect(screen.getByTestId('access-recovery')).toBeTruthy();
  });

  it('renders in the host’s language', () => {
    show('ar');

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'كيف سار اللقاء؟',
    );
  });
});
