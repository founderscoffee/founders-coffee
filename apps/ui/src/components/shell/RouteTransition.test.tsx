import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { route_loading } from '@founders-coffee/i18n';

import { RouteTransition } from './RouteTransition';

afterEach(cleanup);

describe('route transition', () => {
  it('names itself for a screen reader in the reader locale', () => {
    render(<RouteTransition locale="ar" />);

    expect(screen.getByRole('status').textContent).toBe(
      route_loading({}, { locale: 'ar' }),
    );
  });

  it('draws the animated mark and hides it from the accessibility tree', () => {
    const { container } = render(<RouteTransition locale="en" />);
    const img = container.querySelector('img');

    expect(img?.getAttribute('alt')).toBe('');
    expect(img?.getAttribute('src')).toMatch(/logo-draw/u);
    expect(img?.getAttribute('width')).toBe('96');
  });

  it('falls back to the still mark when motion is unwelcome', () => {
    const { container } = render(<RouteTransition locale="fr" />);
    const source = container.querySelector('picture source');

    expect(source?.getAttribute('media')).toBe(
      '(prefers-reduced-motion: reduce)',
    );
    expect(source?.getAttribute('srcset')).toBe('/branding/pwa-logo-165.webp');
  });
});
