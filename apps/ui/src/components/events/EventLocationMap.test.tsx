import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { EventLocationMap } from './EventLocationMap';

type MockMapProps = {
  children?: ReactNode;
  onLoad?: () => void;
  mapLib?: unknown;
};

const token = vi.hoisted(() => ({ data: 'pk.test' as string | undefined }));

const library = vi.hoisted(() => {
  const download = Promise.resolve({ Map: class {} });
  return { download, load: vi.fn(() => download) };
});

vi.mock('../../features/events/hooks', () => ({
  useMapboxToken: () => token,
}));

vi.mock('../../lib/mapbox-csp', () => ({
  loadMapboxCsp: library.load,
  MAPBOX_WORKER_URL: '/mapbox-gl-csp-worker.js',
}));

vi.mock('react-map-gl/mapbox', () => ({
  Map: ({ children, onLoad, mapLib }: MockMapProps) => (
    <div
      data-testid="map-surface"
      data-has-library={String(mapLib === library.download)}
    >
      <button
        type="button"
        data-testid="map-loaded"
        onClick={() => onLoad?.()}
      />
      {children}
    </div>
  ),
  Marker: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));

const show = () =>
  render(
    <EventLocationMap
      locale="ar"
      venue="مقهى الجزائر"
      latitude={36.7538}
      longitude={3.0588}
    />,
  );

const skeleton = () =>
  screen
    .queryAllByRole('status')
    .find((region) => region.textContent === 'جارٍ تحميل الخريطة…') ?? null;

afterEach(() => {
  cleanup();
  token.data = 'pk.test';
});

describe('what the event page shows while its map is loading', () => {
  it('covers the map with a skeleton until the tiles arrive', () => {
    show();

    expect(
      skeleton(),
      'the map sits on a bg-base-200 box, so until Mapbox paints there is a flat beige rectangle the reader cannot tell from a map that failed',
    ).not.toBeNull();
  });

  it('takes the skeleton away once the map says it has loaded', () => {
    show();

    fireEvent.click(screen.getByTestId('map-loaded'));

    expect(skeleton()).toBeNull();
    expect(screen.getByTestId('map-surface')).toBeTruthy();
  });

  it('shows a pin rather than a skeleton when there is no map to wait for', () => {
    token.data = undefined;
    show();

    expect(
      skeleton(),
      'without a token no map is coming, so a skeleton would promise one forever',
    ).toBeNull();
    expect(screen.queryByTestId('map-surface')).toBeNull();
  });
});

describe('when the event page fetches the map library', () => {
  it('waits for the map to render, so a preload of the page fetches none of it', async () => {
    vi.resetModules();
    library.load.mockClear();
    const { EventLocationMap: Loaded } = await import('./EventLocationMap');

    expect(
      library.load,
      'a hover or a touch on a meetup card preloads this module, and 463 KB came with it on pages that show no map',
    ).not.toHaveBeenCalled();

    render(
      <Loaded
        locale="ar"
        venue="مقهى الجزائر"
        latitude={36.7538}
        longitude={3.0588}
      />,
    );

    expect(library.load).toHaveBeenCalledOnce();
    expect(
      screen.getByTestId('map-surface').getAttribute('data-has-library'),
    ).toBe('true');
  });
});
