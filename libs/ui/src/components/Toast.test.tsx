import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StatusMessage } from './StatusMessage.js';
import { TOAST_DURATION_MS, Toast } from './Toast.js';

const shapeOf = (element: Element): string =>
  element.querySelector('svg')?.innerHTML ?? '';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('Toast', () => {
  it.each([
    ['success', 'status'],
    ['error', 'alert'],
  ] as const)(
    'draws %s with the icon an inline message of that severity has',
    (variant, role) => {
      const toast = render(<Toast message="Saved" variant={variant} />);
      const toastShape = shapeOf(toast.container);
      expect(screen.getByRole(role).getAttribute('aria-atomic')).toBe('true');
      toast.unmount();

      const inline = render(
        <StatusMessage variant={variant}>Saved</StatusMessage>,
      );

      expect(toastShape.length).toBeGreaterThan(0);
      expect(
        toastShape,
        'the same message in a different position drew a different icon',
      ).toBe(shapeOf(inline.container));
    },
  );

  it('hides its icon from assistive technology', () => {
    const { container } = render(<Toast message="Failed" variant="error" />);

    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe(
      'true',
    );
    expect(screen.getByRole('alert').textContent).toBe('Failed');
  });
});

describe('how long a toast stays up', () => {
  const showToast = (variant: 'success' | 'error') => {
    const onDismiss = vi.fn();
    render(
      <Toast
        message="Could not save"
        variant={variant}
        dismissLabel="Dismiss"
        onDismiss={onDismiss}
      >
        <button type="button">Retry</button>
      </Toast>,
    );
    return onDismiss;
  };

  it.each(['success', 'error'] as const)(
    'closes a %s toast five seconds after it appears',
    (variant) => {
      vi.useFakeTimers();
      const onDismiss = showToast(variant);

      act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1));
      expect(onDismiss).not.toHaveBeenCalled();
      act(() => vi.advanceTimersByTime(1));
      expect(
        onDismiss,
        'an error toast used to stay until dismissed by hand, so a host who never touched it kept a red banner over the map',
      ).toHaveBeenCalledOnce();
    },
  );

  it('holds while the pointer is on it, then gives five seconds more', () => {
    vi.useFakeTimers();
    const onDismiss = showToast('error');
    const toast = screen.getByRole('alert');

    act(() => vi.advanceTimersByTime(4_000));
    fireEvent.pointerEnter(toast);
    act(() => vi.advanceTimersByTime(60_000));
    expect(onDismiss).not.toHaveBeenCalled();

    fireEvent.pointerLeave(toast);
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS - 1));
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(1));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('holds while focus is inside it, so its retry can be reached by keyboard', () => {
    vi.useFakeTimers();
    const onDismiss = showToast('error');

    act(() => screen.getByRole('button', { name: 'Retry' }).focus());
    act(() => screen.getByRole('button', { name: 'Dismiss' }).focus());
    act(() => vi.advanceTimersByTime(60_000));
    expect(
      onDismiss,
      'focus moving from one of its buttons to the other is still focus inside the toast',
    ).not.toHaveBeenCalled();

    act(() => screen.getByRole('button', { name: 'Dismiss' }).blur());
    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('leaves a toast that cannot be dismissed to whoever shows it', () => {
    vi.useFakeTimers();
    render(<Toast message="Failed" variant="error" />);

    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole('alert').textContent).toBe('Failed');
  });
});
