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

const refuse = (code: string) => {
  state.save = {
    ...state.save,
    isError: true,
    error: Object.assign(new Error('x'), { code }),
  };
};

const markOnePersonAndSubmit = () => {
  fireEvent.click(screen.getByRole('radio', { name: /It happened/i }));
  fireEvent.click(screen.getAllByRole('radio', { name: /^Came$/i })[0]!);
  fireEvent.click(screen.getByRole('button', { name: /Submit/i }));
};

describe('a submission the server refused', () => {
  it('moves focus to the reason, which is nowhere near the button', () => {
    const { rerender } = show();
    markOnePersonAndSubmit();

    refuse('closeout_event_cancelled');
    rerender(<CloseoutPage locale="en" eventId="evt_1" />);

    const alert = screen.getByRole('alert');
    expect(alert.textContent).toMatch(/cancelled/i);
    expect(document.activeElement).toBe(alert);
  });

  it('keeps every answer the host already gave, so retrying is one press', () => {
    const { rerender } = show();
    markOnePersonAndSubmit();

    refuse('closeout_failed');
    rerender(<CloseoutPage locale="en" eventId="evt_1" />);

    expect(
      (screen.getAllByRole('radio', { name: /^Came$/i })[0] as HTMLInputElement)
        .checked,
    ).toBe(true);
    fireEvent.click(screen.getByRole('button', { name: /Submit/i }));
    expect(state.sent).toHaveLength(2);
    expect(state.sent[1]).toEqual(state.sent[0]);
  });

  it('gives way to the confirmation once the retry lands', () => {
    const { rerender } = show();
    markOnePersonAndSubmit();

    refuse('closeout_failed');
    rerender(<CloseoutPage locale="en" eventId="evt_1" />);
    state.save = {
      ...state.save,
      isError: false,
      error: null,
      isSuccess: true,
      data: { refusedMarks: [] },
    };
    rerender(<CloseoutPage locale="en" eventId="evt_1" />);

    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('status').textContent).toMatch(/Thank you/i);
  });
});
