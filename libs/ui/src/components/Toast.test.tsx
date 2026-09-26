import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { StatusMessage } from './StatusMessage.js';
import { Toast } from './Toast.js';

const shapeOf = (element: Element): string =>
  element.querySelector('svg')?.innerHTML ?? '';

afterEach(cleanup);

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
