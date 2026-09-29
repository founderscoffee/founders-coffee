import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { TOAST_DURATION_MS } from '@founders-coffee/ui';

import { HostMapToasts } from './HostMapToasts';

describe('HostMapToasts', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('closes an error five seconds after it appears, offering its retry until then', () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    const onDismiss = vi.fn();
    render(
      <HostMapToasts
        locale="en"
        isResolving={false}
        error="Could not load the venue map."
        onRetry={onRetry}
        onDismiss={onDismiss}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(TOAST_DURATION_MS - 1);
    });

    expect(screen.getByRole('alert').textContent).toContain(
      'Could not load the venue map.',
    );
    screen.getByRole('button', { name: 'Retry' }).click();
    expect(onRetry).toHaveBeenCalledOnce();
    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('holds the resolving toast for as long as the lookup runs', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <HostMapToasts
        locale="en"
        isResolving
        error={null}
        onDismiss={() => undefined}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByRole('status').textContent).toContain(
      'Locating the venue…',
    );

    rerender(
      <HostMapToasts
        locale="en"
        isResolving={false}
        error={null}
        onDismiss={() => undefined}
      />,
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});
