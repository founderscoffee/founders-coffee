import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  feedback_error_generic,
  feedback_error_not_attended,
  feedback_error_window_closed,
  feedback_saved,
  loading,
} from '@founders-coffee/i18n';

const state = vi.hoisted(() => ({
  query: {} as Record<string, unknown>,
  save: {} as Record<string, unknown>,
}));

vi.mock('../hooks', () => ({
  useFeedback: () => state.query,
  useSubmitFeedback: () => state.save,
}));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/">{children}</a>,
}));
vi.mock('../../profile/components/ProfileAccess', () => ({
  ProfileAccess: () => <div data-testid="access-recovery" />,
}));

const { FeedbackPage } = await import('./FeedbackPage');

const EN = { locale: 'en' } as const;

const view = (overrides: Record<string, unknown> = {}) => ({
  eventId: 'evt_1',
  title: 'Founders morning',
  venue: 'Café',
  slug: 'founders-morning',
  marketCode: 'DZ',
  marketSlug: 'algeria',
  cityCode: '556',
  citySlug: 'algiers',
  status: 'ready',
  feedback: null,
  nextEvent: null,
  ...overrides,
});

const show = () => render(<FeedbackPage locale="en" eventId="evt_1" />);

const iconIn = (element: HTMLElement) => element.querySelector('svg');

beforeEach(() => {
  state.query = {
    data: view(),
    isError: false,
    error: null,
    userId: 'usr_guest',
    isAuthLoading: false,
    refetch: vi.fn(),
  };
  state.save = {
    mutate: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    error: null,
  };
});

afterEach(() => cleanup());

describe('the end of the feedback flow', () => {
  it('confirms a saved answer as a success message rather than a green sentence', () => {
    state.save = { ...state.save, isSuccess: true };

    show();

    const confirmation = screen.getByRole('status');
    expect(confirmation.textContent).toBe(feedback_saved({}, EN));
    expect(confirmation.className).toContain('alert-success');
    expect(
      iconIn(confirmation),
      'after the form disappears this is the only sign anything happened, and colour alone does not say it worked',
    ).not.toBeNull();
  });

  it('moves focus to a refusal and marks it as an error', () => {
    const { rerender } = show();
    state.save = {
      ...state.save,
      isError: true,
      error: Object.assign(new Error('x'), { code: 'feedback_not_attended' }),
    };

    rerender(<FeedbackPage locale="en" eventId="evt_1" />);

    const refusal = screen.getByRole('alert');
    expect(refusal.textContent).toBe(feedback_error_not_attended({}, EN));
    expect(refusal.className).toContain('alert-error');
    expect(iconIn(refusal)).not.toBeNull();
    expect(document.activeElement).toBe(refusal);
  });

  it('says a closed window as information, not as a failure', () => {
    state.query = { ...state.query, data: view({ status: 'window_closed' }) };

    show();

    const notice = screen.getByRole('status');
    expect(notice.textContent).toBe(feedback_error_window_closed({}, EN));
    expect(notice.className).toContain('alert-info');
    expect(screen.queryByRole('alert')).toBeNull();
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
      feedback_error_generic({}, EN),
    );
    expect(screen.getByRole('alert').className).toContain('alert-error');
  });

  it('waits with a spinner beside the words', () => {
    state.query = { ...state.query, data: undefined };

    show();

    const waiting = screen.getByRole('status');
    expect(waiting.textContent).toBe(loading({}, EN));
    expect(waiting.querySelector('.loading-spinner')).not.toBeNull();
  });
});
