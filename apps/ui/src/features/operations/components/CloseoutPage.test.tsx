import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { closeout_already_done, type Locale } from '@founders-coffee/i18n';

const state = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  save: {} as Record<string, unknown>,
  repeat: {} as Record<string, unknown>,
  tally: {} as Record<string, unknown>,
  sent: [] as unknown[],
}));

vi.mock('../hooks', () => ({
  useCloseout: () => state.query,
  useSubmitCloseout: () => state.save,
  useFeedbackTally: () => state.tally,
}));
vi.mock('../../events/hooks', () => ({
  useRepeatEventTemplate: () => state.repeat,
}));
vi.mock('../../../components/events/RepeatHostLink', () => ({
  RepeatHostLink: () => <a href="/host">Host it again</a>,
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

const first = <T,>(items: readonly T[]): T => {
  const item = items[0];
  if (item === undefined) throw new Error('Expected a rendered radio');
  return item;
};

beforeEach(() => {
  state.sent = [];
  state.tally = { data: undefined };
  state.query = {
    data: view(),
    isError: false,
    error: null,
    userId: 'usr_host',
    isAuthLoading: false,
    refetch: vi.fn(),
  };
  state.repeat = { data: null };
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

    fireEvent.click(first(screen.getAllByRole('radio', { name: /^Came$/i })));

    expect(screen.getByText(/1 of the people who said/i)).toBeTruthy();
    expect(screen.getByText(/1 in the room altogether/i)).toBeTruthy();
  });

  it('adds walk-ins to the room but not to the registered count', () => {
    show();
    fireEvent.click(screen.getByRole('radio', { name: /It happened/i }));
    fireEvent.click(first(screen.getAllByRole('radio', { name: /^Came$/i })));
    fireEvent.change(screen.getByLabelText(/without saying so/i), {
      target: { value: '2' },
    });

    expect(screen.getByText(/1 of the people who said/i)).toBeTruthy();
    expect(screen.getByText(/3 in the room altogether/i)).toBeTruthy();
  });

  it('sends the marks alongside the outcome', () => {
    show();
    fireEvent.click(screen.getByRole('radio', { name: /It happened/i }));
    fireEvent.click(first(screen.getAllByRole('radio', { name: /^Came$/i })));
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
  fireEvent.click(first(screen.getAllByRole('radio', { name: /^Came$/i })));
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
    expect(
      screen.getByRole('status').textContent,
      'both confirmations end in "Thank you", so matching that alone agreed with the page whichever one it showed',
    ).toContain('Recorded');
  });
});

const landed = (refusedMarks: string[] = []) => {
  state.save = { ...state.save, isSuccess: true, data: { refusedMarks } };
  state.query = { ...state.query, data: view({ outcome: 'held' }) };
};

describe('the closeout the host just submitted', () => {
  it('confirms what was recorded instead of saying it was already done', () => {
    const { rerender } = show();
    markOnePersonAndSubmit();

    landed();
    rerender(<CloseoutPage locale="en" eventId="evt_1" />);

    expect(
      screen.getByRole('status').textContent,
      'submitting invalidates the view, so the refetch lands with an outcome and the already-closed arm wins the race. The host is told their submission was a no-op at the moment it succeeded',
    ).toContain('Recorded');
  });

  it('warns when some names could not be recorded', () => {
    const { rerender } = show();
    markOnePersonAndSubmit();

    landed(['usr_b']);
    rerender(<CloseoutPage locale="en" eventId="evt_1" />);

    expect(
      screen.queryByRole('alert')?.textContent,
      'attendance gates attendee feedback, so a mark the server refused is silent data loss and this warning can never fire from behind the already-closed arm',
    ).toContain('could not be recorded');
  });

  it('offers hosting it again, at the moment the host said they would', () => {
    state.repeat = { data: { marketCode: 'DZ', cityCode: '556' } };
    const { rerender } = render(
      <CloseoutPage
        locale="en"
        eventId="evt_1"
        markets={[{ code: 'DZ', slug: 'algeria' }]}
      />,
    );
    markOnePersonAndSubmit();

    landed();
    rerender(
      <CloseoutPage
        locale="en"
        eventId="evt_1"
        markets={[{ code: 'DZ', slug: 'algeria' }]}
      />,
    );

    expect(
      screen.queryByRole('link', { name: /Host it again/i }),
      'the repeat template is fetched on success and was then discarded, losing the compounding loop at its highest-intent moment',
    ).toBeTruthy();
  });

  it('still says already closed to a host who did not just submit', () => {
    state.query = { ...state.query, data: view({ outcome: 'held' }) };
    show();

    expect(
      screen.getByRole('status').textContent,
      'the already-closed arm is for arriving at a closeout someone has already submitted; reordering must not delete it',
    ).toContain(closeout_already_done({}, { locale: 'en' }));
  });
});
