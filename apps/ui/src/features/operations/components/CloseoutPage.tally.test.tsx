import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

import { copy } from './closeout-copy.fixtures';

const state = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  save: {} as Record<string, unknown>,
  tally: {} as Record<string, unknown>,
  asked: [] as { eventId: string; enabled: boolean }[],
}));

vi.mock('../hooks', () => ({
  useCloseout: () => state.query,
  useSubmitCloseout: () => state.save,
  useFeedbackTally: (eventId: string, enabled: boolean) => {
    state.asked.push({ eventId, enabled });
    return state.tally;
  },
}));
vi.mock('../../events/hooks', () => ({
  useRepeatEventTemplate: () => ({ data: null }),
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
  roster: [{ userId: 'usr_a', name: 'Amina', outcome: null }],
  registeredAttended: 0,
  totalAttended: 0,
  ...overrides,
});

const show = (locale: Locale = 'en') =>
  render(<CloseoutPage locale={locale} eventId="evt_1" />);

const closedOut = () => {
  state.query = { ...state.query, data: view({ outcome: 'held', version: 1 }) };
};

beforeEach(() => {
  state.asked = [];
  state.tally = { data: undefined };
  state.query = {
    data: view(),
    isError: false,
    error: null,
    userId: 'usr_host',
    isAuthLoading: false,
    refetch: vi.fn(),
  };
  state.save = {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
    data: undefined,
  };
});

afterEach(() => cleanup());

describe('what a host learns when they come back to a closed-out gathering', () => {
  it('shows the pulse the attendees left', () => {
    closedOut();
    state.tally = {
      data: {
        state: 'shown',
        responses: 4,
        wouldReturn: 3,
        valuable: 2,
        okay: 1,
        notValuable: 1,
      },
    };

    show();

    const text = screen.getByRole('heading', { level: 2 }).parentElement
      ?.textContent;
    expect(text).toContain(copy.responses(4));
    expect(text).toContain(copy.valuable(2));
    expect(text).toContain(copy.okay(1));
    expect(text).toContain(copy.notValuable(1));
    expect(text).toContain(copy.wouldReturn(3));
  });

  it('says why there is no summary yet instead of showing an empty one', () => {
    closedOut();
    state.tally = { data: { state: 'below_floor' } };

    show();

    const text = document.body.textContent ?? '';
    expect(text).toMatch(/Not enough responses yet/i);
    for (const line of copy.ratingLabels)
      expect(
        text,
        'a suppressed summary must not print the counts it is suppressing',
      ).not.toContain(line);
  });

  it('keeps saying the gathering is already closed out', () => {
    closedOut();
    state.tally = { data: { state: 'below_floor' } };

    show();

    expect(screen.getByRole('status').textContent).toMatch(
      /Already closed out/i,
    );
  });

  it('renders nothing extra while the summary is still being fetched', () => {
    closedOut();
    state.tally = { data: undefined };

    show();

    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('does not ask for a summary of a gathering that has not been closed out', () => {
    show();

    expect(state.asked.at(-1)).toEqual({ eventId: 'evt_1', enabled: false });
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
  });

  it('does not ask for a summary in the moment after the host submits one', () => {
    closedOut();
    state.save = { ...state.save, isSuccess: true, data: { refusedMarks: [] } };

    show();

    expect(
      state.asked.at(-1)?.enabled,
      'the receipt is what the host just asked for; nobody has answered yet, so a summary here would only ever say there is nothing',
    ).toBe(false);
  });

  it('speaks the host’s language', () => {
    closedOut();
    state.tally = { data: { state: 'below_floor' } };

    show('ar');

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      'كيف وجده الحاضرون',
    );
  });
});
