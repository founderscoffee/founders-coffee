import { CatchBoundary } from '@tanstack/react-router';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const MAP_FAILED = 'Could not load the venue map.';
const ROUTE_FAILED = 'The route error page';

const observability = vi.hoisted(() => ({
  logger: {},
  reportError: vi.fn(),
}));

vi.mock('@founders-coffee/observability', () => observability);

const lostChunk = new TypeError(
  'Failed to fetch dynamically imported module: https://founders.coffee/assets/HostMap-Dk3jQ0aB.js',
);

const RouteError = () => <p>{ROUTE_FAILED}</p>;

const panelWithoutItsMap = async () => {
  vi.resetModules();
  vi.doMock('./HostMap', () => {
    throw lostChunk;
  });
  const { HostMapPanel } = await import('./HostMapPanel');
  await act(async () => {
    render(
      <CatchBoundary getResetKey={() => 0} errorComponent={RouteError}>
        <HostMapPanel
          locale="en"
          accessToken="test-token"
          marketCode="DZ"
          venue={null}
          viewport={{
            center: { latitude: 36.7538, longitude: 3.0588 },
            bounds: [2.9, 36.6, 3.3, 36.9],
          }}
          error={null}
          isInteractive
          onRetry={vi.fn()}
          onVenueSelect={vi.fn()}
          onVenueInvalidate={vi.fn()}
        />
      </CatchBoundary>,
    );
  });
};

const reload = vi.fn();

beforeEach(() => {
  vi.stubGlobal('location', { ...window.location, reload });
});

afterEach(() => {
  cleanup();
  vi.doUnmock('./HostMap');
  vi.unstubAllGlobals();
  reload.mockReset();
  observability.reportError.mockReset();
});

describe('the venue map panel when the map’s own code never arrives', () => {
  it('shows the map’s failure state, and the page around it stays', async () => {
    await panelWithoutItsMap();

    await waitFor(() => {
      expect(
        screen.queryByText(ROUTE_FAILED),
        'the failed import of HostMap reached the route, whose error page then replaced the whole wizard or edit page',
      ).toBeNull();
      expect(screen.getByText(MAP_FAILED)).toBeTruthy();
    });
    expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
  });

  it('loads the page again on Retry, the only way to fetch that code again', async () => {
    await panelWithoutItsMap();
    await screen.findByText(MAP_FAILED);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    });

    expect(
      reload,
      'a browser keeps a module that failed to load as failed for the rest of the page, so a remount only meets the same failure',
    ).toHaveBeenCalledOnce();
  });

  it('reports the failure once, as the host map’s', async () => {
    await panelWithoutItsMap();
    await screen.findByText(MAP_FAILED);

    expect(observability.reportError).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ cause: lostChunk }),
      { source: 'host_map' },
      observability.logger,
    );
  });
});
