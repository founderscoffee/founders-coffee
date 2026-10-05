import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { createElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MapError = { type: 'error'; target: object | null; error: Error };

type MapStandInProps = {
  mapLib?: unknown;
  onError?: (event: MapError) => void;
  onLoad?: () => void;
};

const MAP_FAILED = 'Could not load the venue map.';

const surface = vi.hoisted(() => ({ mounts: 0 }));

vi.mock('@founders-coffee/observability', () => ({
  logger: { warn: vi.fn() },
}));

vi.mock('../../features/events/hooks', () => ({
  useReverseEventVenue: () => ({ isPending: false, mutateAsync: vi.fn() }),
}));

vi.mock('../../features/geo/hooks', () => ({
  useCitySuggestions: () => ({ data: undefined }),
  useDebouncedValue: <T,>(value: T) => value,
}));

vi.mock('react-map-gl/mapbox', async () => {
  const { createElement: draw, useEffect } = await import('react');
  return {
    Map: ({ mapLib, onError, onLoad }: MapStandInProps) => {
      useEffect(() => {
        surface.mounts += 1;
        void Promise.resolve(mapLib)
          .then(() => onLoad?.())
          .catch((error: Error) =>
            onError?.({ type: 'error', target: null, error }),
          );
      }, []);
      return draw(
        'button',
        {
          type: 'button',
          'data-testid': 'map-surface',
          onClick: () =>
            onError?.({
              type: 'error',
              target: {},
              error: new Error('The style could not be loaded'),
            }),
        },
        'Mapbox fails',
      );
    },
    Marker: () => null,
  };
});

const failedDownload = () => {
  throw new TypeError(
    'Failed to fetch dynamically imported module: https://founders.coffee/assets/mapbox-gl-csp-DhIhBfn2.js',
  );
};

const mapOver = async (library: () => object) => {
  vi.resetModules();
  vi.doMock('mapbox-gl/dist/mapbox-gl-csp.js', library);
  const { HostMap } = await import('./HostMap');
  await act(async () => {
    render(
      createElement(HostMap, {
        accessToken: 'test-token',
        venue: null,
        viewport: {
          center: { latitude: 36.7538, longitude: 3.0588 },
          bounds: [2.9, 36.6, 3.3, 36.9],
        },
        marketCode: 'DZ',
        locale: 'en',
        onVenueSelect: vi.fn(),
        onVenueInvalidate: vi.fn(),
      }),
    );
  });
};

const pressRetry = () =>
  act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
  });

const reload = vi.fn();

beforeEach(() => {
  surface.mounts = 0;
  vi.stubGlobal('location', { ...window.location, reload });
});

afterEach(() => {
  cleanup();
  vi.doUnmock('mapbox-gl/dist/mapbox-gl-csp.js');
  vi.unstubAllGlobals();
  reload.mockReset();
});

describe('Retry on the host map', () => {
  it('loads the page again when the map library never arrived', async () => {
    await mapOver(failedDownload);
    expect(await screen.findByText(MAP_FAILED)).toBeTruthy();

    await pressRetry();

    expect(
      reload,
      'a browser keeps a module that failed to load as failed for the rest of the page, so remounting the map met the same failure and only a new page load fetches the library again',
    ).toHaveBeenCalledOnce();
  });

  it('remounts the map for any other failure, without leaving the page', async () => {
    await mapOver(() => ({ default: { Map: class {} } }));
    fireEvent.click(screen.getByTestId('map-surface'));
    expect(await screen.findByText(MAP_FAILED)).toBeTruthy();

    await pressRetry();

    expect(surface.mounts).toBe(2);
    expect(screen.queryByText(MAP_FAILED)).toBeNull();
    expect(reload).not.toHaveBeenCalled();
  });
});
