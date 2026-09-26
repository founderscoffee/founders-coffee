import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  closeout_error_generic,
  closeout_refused_marks,
  loading,
} from '@founders-coffee/i18n';

import { copy } from './closeout-copy.fixtures';

const state = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  save: {} as Record<string, unknown>,
}));

vi.mock('../hooks', () => ({
  useCloseout: () => state.query,
  useSubmitCloseout: () => state.save,
  useFeedbackTally: () => ({ data: undefined }),
}));
vi.mock('../../events/hooks', () => ({
  useRepeatEventTemplate: () => ({ data: null }),
}));
vi.mock('../../profile/components/ProfileAccess', () => ({
  ProfileAccess: () => <div data-testid="access-recovery" />,
}));

const { CloseoutPage } = await import('./CloseoutPage');

const EN = { locale: 'en' } as const;

const view = (overrides: Record<string, unknown> = {}) => ({
  eventId: 'evt_1',
  outcome: null,
  version: 0,
  walkInCount: 0,
  roster: [],
  registeredAttended: 0,
  totalAttended: 0,
  ...overrides,
});

const show = () => render(<CloseoutPage locale="en" eventId="evt_1" />);

beforeEach(() => {
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

describe('how the closeout says what happened', () => {
  it('confirms a recorded closeout as a success, not as body copy', () => {
    state.save = { ...state.save, isSuccess: true, data: { refusedMarks: [] } };
    state.query = { ...state.query, data: view({ outcome: 'held' }) };

    show();

    const confirmation = screen.getByRole('status');
    expect(confirmation.textContent).toBe(copy.done);
    expect(
      confirmation.className,
      'the closeout confirmation was styled exactly like the paragraph above it',
    ).toContain('alert-success');
    expect(confirmation.querySelector('svg')).not.toBeNull();
  });

  it('warns about refused names as a warning, beside the confirmation', () => {
    state.save = {
      ...state.save,
      isSuccess: true,
      data: { refusedMarks: ['usr_b'] },
    };
    state.query = { ...state.query, data: view({ outcome: 'held' }) };

    show();

    const warning = screen.getByRole('alert');
    expect(warning.textContent).toBe(closeout_refused_marks({}, EN));
    expect(warning.className).toContain('alert-warning');
    expect(screen.getByRole('status').className).toContain('alert-success');
  });

  it('marks a closeout someone already submitted as done', () => {
    state.query = { ...state.query, data: view({ outcome: 'held' }) };

    show();

    expect(screen.getByRole('status').textContent).toBe(copy.alreadyDone);
    expect(screen.getByRole('status').className).toContain('alert-success');
  });

  it('names a view that could not load as an error', () => {
    state.query = {
      ...state.query,
      data: undefined,
      isError: true,
      error: new Error('x'),
    };

    show();

    expect(screen.getByRole('alert').textContent).toBe(
      closeout_error_generic({}, EN),
    );
    expect(screen.getByRole('alert').className).toContain('alert-error');
  });

  it('waits with a spinner beside the words', () => {
    state.query = { ...state.query, data: undefined };

    show();

    expect(screen.getByRole('status').textContent).toBe(loading({}, EN));
    expect(
      screen.getByRole('status').querySelector('.loading-spinner'),
    ).not.toBeNull();
  });
});
