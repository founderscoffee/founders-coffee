import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  profile_retry,
  profile_saved,
  toast_dismiss,
  type Locale,
} from '@founders-coffee/i18n';
import { useToast } from '@founders-coffee/ui';

import { ProfileFeedback } from './ProfileFeedback';

const Harness = ({ locale = 'en' }: { locale?: Locale }) => {
  const feedback = useToast();
  return (
    <>
      <button
        onClick={() => feedback.show(profile_saved({}, { locale }), 'success')}
      >
        Save
      </button>
      <button onClick={() => feedback.show('Failed action', 'error')}>
        Fail
      </button>
      <ProfileFeedback
        locale={locale}
        notification={feedback.notification}
        onDismiss={feedback.clear}
      />
    </>
  );
};

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('profile toast feedback', () => {
  it.each<Locale>(['ar', 'fr', 'en'])(
    'announces green success and supports dismissal in %s',
    (locale) => {
      const view = render(<Harness locale={locale} />);
      expect(screen.queryByRole('status')).toBeNull();
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
      const toast = screen.getByRole('status');
      expect(toast.textContent).toContain(profile_saved({}, { locale }));
      expect(toast.className).toContain('alert-success');
      expect(toast.className).not.toContain('alert-soft');
      expect(toast.closest('.toast')?.className).toContain('toast-top');
      expect(
        screen.getByRole('button', { name: toast_dismiss({}, { locale }) })
          .className,
      ).toContain('text-inherit');
      fireEvent.click(
        screen.getByRole('button', { name: toast_dismiss({}, { locale }) }),
      );
      expect(view.container.querySelector('.alert')).toBeNull();
    },
  );

  it('restarts expiry for a repeated success and does not replay a dismissed toast', () => {
    vi.useFakeTimers();
    const view = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    act(() => vi.advanceTimersByTime(4000));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    act(() => vi.advanceTimersByTime(4000));
    expect(screen.getByRole('status')).toBeTruthy();
    act(() => vi.advanceTimersByTime(1000));
    expect(screen.queryByRole('status')).toBeNull();
    view.rerender(<Harness />);
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('replaces success with a persistent red error, unaffected by the old expiry', () => {
    vi.useFakeTimers();
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    act(() => vi.advanceTimersByTime(4000));
    fireEvent.click(screen.getByRole('button', { name: 'Fail' }));
    act(() => vi.advanceTimersByTime(10000));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByRole('alert').className).toContain('alert-error');
    expect(screen.getByRole('alert').className).not.toContain('alert-soft');
    expect(
      screen.getByRole('button', { name: 'Dismiss notification' }).className,
    ).toContain('text-inherit');
    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss notification' }),
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('keeps the retry action legible on the filled security-error toast', () => {
    const onRetry = vi.fn();
    render(
      <ProfileFeedback
        locale="en"
        notification={null}
        onDismiss={vi.fn()}
        hasSecurityError
        onRetry={onRetry}
      />,
    );

    const retry = screen.getByRole('button', {
      name: profile_retry({}, { locale: 'en' }),
    });
    expect(retry.className).toContain('text-inherit');
    fireEvent.click(retry);
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('does not leak notifications across mounted editors or remounts', () => {
    const first = render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    const second = render(<Harness />);
    expect(second.container.querySelector('.alert')).toBeNull();
    first.unmount();
    expect(screen.queryByRole('status')).toBeNull();
  });
});
