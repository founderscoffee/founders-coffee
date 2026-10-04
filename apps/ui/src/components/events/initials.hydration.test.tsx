import { createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Locale } from '@founders-coffee/i18n';

import { hydrate, unmountHydrated } from './hydration.fixtures';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) =>
    createElement('a', { href: '/' }, children),
}));

const { HostFace } = await import('./HostFace');
const { EventHostCard } = await import('./EventHostCard');

type Host = Parameters<typeof EventHostCard>[0]['host'];

const rocket = { userId: 'usr_1', displayName: '🚀 Rocket Founders' } as Host;

afterEach(unmountHydrated);

describe('initials the server sends and the browser hydrates', () => {
  it('hydrates the face of a host whose name starts with an emoji', async () => {
    const { container, reported } = await hydrate(
      <HostFace name="🚀 Rocket Founders" photoAssetId={null} />,
    );

    expect(
      reported,
      'half an emoji is a lone surrogate: the HTML carries U+FFFD in its place while the browser renders the half, so React threw the server HTML away on every page that listed this host',
    ).toEqual([]);
    expect(container.textContent).toBe('🚀');
  });

  it.each<Locale>(['ar', 'en'])(
    'hydrates the host card of a host whose name starts with an emoji, in %s',
    async (locale) => {
      const { container, reported } = await hydrate(
        <EventHostCard
          locale={locale}
          host={rocket}
          cityName="Algiers"
          isHost={false}
        />,
      );

      expect(reported).toEqual([]);
      expect(
        container.querySelector('span[aria-hidden="true"]')?.textContent,
      ).toBe('🚀R');
    },
  );
});
