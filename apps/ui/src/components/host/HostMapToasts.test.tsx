import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HostMapToasts } from './HostMapToasts';

describe('HostMapToasts', () => {
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('keeps an error up, with its retry, until the host acts on it', () => {
    vi.useFakeTimers();
    const onRetry = vi.fn();
    render(
      <HostMapToasts
        locale="en"
        isResolving={false}
        error="Could not load the venue map."
        onRetry={onRetry}
      />,
    );

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    expect(screen.getByRole('alert').textContent).toContain(
      'Could not load the venue map.',
    );
    screen.getByRole('button', { name: 'Retry' }).click();
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('holds the resolving toast for as long as the lookup runs', () => {
    vi.useFakeTimers();
    const { rerender } = render(
      <HostMapToasts locale="en" isResolving error={null} />,
    );

    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(screen.getByRole('status').textContent).toContain(
      'Locating the venue…',
    );

    rerender(<HostMapToasts locale="en" isResolving={false} error={null} />);
    expect(screen.queryByRole('status')).toBeNull();
  });
});
