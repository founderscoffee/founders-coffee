import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { LoadingStatus } from './LoadingStatus.js';

afterEach(cleanup);

describe('LoadingStatus', () => {
  it('says what is loading, politely and whole', () => {
    render(<LoadingStatus label="Loading…" />);

    const region = screen.getByRole('status');
    expect(region.textContent).toBe('Loading…');
    expect(region.getAttribute('aria-atomic')).toBe('true');
  });

  it('draws a spinner beside the words, hidden from assistive technology', () => {
    const { container } = render(<LoadingStatus label="Loading…" />);
    const spinner = container.querySelector('.loading');

    expect(spinner?.className).toContain('loading-spinner');
    expect(spinner?.getAttribute('aria-hidden')).toBe('true');
    expect(screen.getByText('Loading…').className).not.toContain('sr-only');
  });

  it('leaves the drawing to the caller when the label is hidden', () => {
    const { container } = render(
      <LoadingStatus
        label="Loading the map…"
        isLabelHidden
        className="skeleton"
      >
        <span data-testid="shape" aria-hidden="true" />
      </LoadingStatus>,
    );

    expect(container.querySelector('.loading')).toBeNull();
    expect(screen.getByTestId('shape')).toBeTruthy();
    expect(screen.getByText('Loading the map…').className).toContain('sr-only');
    expect(screen.getByRole('status').className).toContain('skeleton');
    expect(screen.getByRole('status').textContent).toBe('Loading the map…');
  });

  it('keeps its type size beside its colour, and lets the caller change the size', () => {
    const { rerender } = render(<LoadingStatus label="Loading…" />);
    expect(screen.getByRole('status').className).toContain('text-body-sm');
    expect(screen.getByRole('status').className).toContain('text-neutral');

    rerender(<LoadingStatus label="Loading…" className="text-caption" />);
    expect(screen.getByRole('status').className).toContain('text-caption');
    expect(screen.getByRole('status').className).not.toContain('text-body-sm');
  });
});
