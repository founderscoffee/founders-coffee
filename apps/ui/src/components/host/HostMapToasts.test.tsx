import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HostMapToasts } from './HostMapToasts';

describe('HostMapToasts', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('retires an error toast after five seconds', () => {
    vi.useFakeTimers();
    const onErrorExpire = vi.fn();
    render(
      <HostMapToasts
        locale="en"
        isResolving={false}
        error="The venue map is unavailable right now."
        onErrorExpire={onErrorExpire}
        onRetry={vi.fn()}
      />,
    );

    expect(screen.getByRole('alert').textContent).toContain(
      'The venue map is unavailable right now.',
    );
    act(() => {
      vi.advanceTimersByTime(4_999);
    });
    expect(onErrorExpire).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onErrorExpire).toHaveBeenCalledOnce();
  });

  it('holds the resolving toast for as long as the lookup runs', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <HostMapToasts
        locale="en"
        isResolving
        error={null}
        onErrorExpire={vi.fn()}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByRole('status').textContent).toContain(
      'Checking this venue…',
    );

    rerender(
      <HostMapToasts
        locale="en"
        isResolving={false}
        error={null}
        onErrorExpire={vi.fn()}
      />,
    );
    expect(screen.queryByRole('status')).toBeNull();
  });
});
