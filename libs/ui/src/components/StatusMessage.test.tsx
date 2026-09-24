import { cleanup, render, screen } from '@testing-library/react';
import { createRef } from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import { StatusMessage } from './StatusMessage.js';

const VARIANTS = ['success', 'error', 'warning', 'info'] as const;

const shapeOf = (element: Element): string =>
  element.querySelector('svg')?.innerHTML ?? '';

afterEach(cleanup);

describe('StatusMessage', () => {
  it.each([
    ['success', 'status'],
    ['info', 'status'],
    ['error', 'alert'],
    ['warning', 'alert'],
  ] as const)('announces %s as a %s region', (variant, role) => {
    render(<StatusMessage variant={variant}>Said once</StatusMessage>);

    const region = screen.getByRole(role);
    expect(region.textContent).toBe('Said once');
    expect(
      region.getAttribute('aria-atomic'),
      'a screen reader rereads the whole message when any of it changes, not the fragment that did',
    ).toBe('true');
  });

  it.each(VARIANTS)('draws %s as a soft daisyUI alert', (variant) => {
    const { container } = render(
      <StatusMessage variant={variant}>Said once</StatusMessage>,
    );

    expect(container.firstElementChild?.className.split(' ')).toEqual(
      expect.arrayContaining(['alert', 'alert-soft', `alert-${variant}`]),
    );
  });

  it('gives each severity a shape of its own, so colour is not the only difference', () => {
    const shapes = VARIANTS.map((variant) => {
      const { container, unmount } = render(
        <StatusMessage variant={variant}>Said once</StatusMessage>,
      );
      const shape = shapeOf(container);
      unmount();
      return shape;
    });

    expect(shapes.every((shape) => shape.length > 0)).toBe(true);
    expect(
      new Set(shapes).size,
      'two severities share an icon, so a reader who cannot tell the colours apart cannot tell the messages apart (WCAG 1.4.1)',
    ).toBe(VARIANTS.length);
  });

  it('hides the icon from assistive technology and gives it no words of its own', () => {
    const { container } = render(
      <StatusMessage variant="error">Could not save</StatusMessage>,
    );
    const icon = container.querySelector('svg');

    expect(icon?.getAttribute('aria-hidden')).toBe('true');
    expect(
      icon?.hasAttribute('aria-label'),
      'the text already says what happened, and a label would be copy that bypasses the message catalogue',
    ).toBe(false);
    expect(icon?.querySelector('title')).toBeNull();
  });

  it('keeps its region, empty and unstyled, while it has nothing to say', () => {
    const { rerender } = render(
      <StatusMessage variant="warning">{null}</StatusMessage>,
    );
    const region = screen.getByRole('alert');

    expect(region.textContent).toBe('');
    expect(region.getAttribute('class')).toBeNull();
    expect(region.querySelector('svg')).toBeNull();

    rerender(<StatusMessage variant="warning">Offline</StatusMessage>);

    expect(
      screen.getByRole('alert'),
      'a message that arrives later is announced as a change to a region already on the page',
    ).toBe(region);
    expect(region.textContent).toBe('Offline');
    expect(region.querySelector('svg')).not.toBeNull();
  });

  it('treats an empty string as nothing to say', () => {
    render(<StatusMessage variant="info">{''}</StatusMessage>);

    expect(screen.getByRole('status').getAttribute('class')).toBeNull();
  });

  it('can take focus, so a refusal can be moved to', () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <StatusMessage ref={ref} variant="error" tabIndex={-1}>
        Refused
      </StatusMessage>,
    );

    ref.current?.focus();

    expect(document.activeElement).toBe(screen.getByRole('alert'));
  });

  it('carries its action inside the message it acts on', () => {
    render(
      <StatusMessage
        variant="error"
        action={<button type="button">Try again</button>}
      >
        Could not load
      </StatusMessage>,
    );

    expect(screen.getByRole('alert').contains(screen.getByRole('button'))).toBe(
      true,
    );
  });

  it('tops its icon on the first line, unless an action sets the height of the row', () => {
    const { container, rerender } = render(
      <StatusMessage variant="error">Could not load</StatusMessage>,
    );
    expect(container.querySelector('svg')?.getAttribute('class')).toContain(
      'self-start',
    );

    rerender(
      <StatusMessage
        variant="error"
        action={<button type="button">Try again</button>}
      >
        Could not load
      </StatusMessage>,
    );
    expect(
      container.querySelector('svg')?.getAttribute('class'),
      'a button is taller than a line of text, so a topped icon sat above the words it belongs to',
    ).not.toContain('self-start');
  });

  it('adds the caller’s classes to its own', () => {
    const { container } = render(
      <StatusMessage variant="info" className="mt-2">
        Said once
      </StatusMessage>,
    );

    expect(container.firstElementChild?.className).toContain('mt-2');
    expect(container.firstElementChild?.className).toContain('alert-info');
  });
});
