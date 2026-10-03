import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  browserAsked,
  CAFE,
  camera,
  flewTo,
  hostMap,
  press,
  renderHostMap,
  reverse,
  settle,
  STREET,
} from './HostMap.fixtures';

const HERE = { latitude: 36.7731, longitude: 3.0595 };

const LOCATING = 'Locating the venue…';

const NO_LOCATION =
  'We could not access your location. You can use search or the map.';

beforeEach(() => {
  reverse.mutateAsync.mockReturnValue(new Promise(() => undefined));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe('Locate me on the host map', () => {
  it('flies close in to where the host is and chooses that spot, as a tap there would', async () => {
    reverse.mutateAsync.mockResolvedValueOnce(STREET);
    const onVenueSelect = vi.fn();
    const onVenueInvalidate = vi.fn();
    const onUserGestureEnd = vi.fn();
    const browser = browserAsked();
    const { rerender } = renderHostMap({
      onVenueSelect,
      onVenueInvalidate,
      onUserGestureEnd,
    });

    press('Locate me');
    expect(reverse.mutateAsync).not.toHaveBeenCalled();
    await settle(() => browser.found(HERE));
    await waitFor(() =>
      expect(onVenueSelect).toHaveBeenCalledWith({ ...STREET, ...HERE }),
    );

    expect(
      camera.flyTo,
      'close enough for the host to see the building they are in',
    ).toHaveBeenCalledWith(flewTo(HERE, 17));
    expect(onVenueInvalidate).toHaveBeenCalledOnce();
    expect(reverse.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining(HERE),
    );
    expect(
      onUserGestureEnd,
      'the host chose the map over the search box',
    ).toHaveBeenCalledOnce();

    rerender(hostMap({ onVenueSelect, venue: { ...STREET, ...HERE } }));
    expect(screen.getByTestId('map-marker').dataset.at).toBe(
      `${HERE.latitude},${HERE.longitude}`,
    );
    expect(
      camera.flyTo,
      'the address arriving for the spot flew the camera back out to a café’s zoom',
    ).toHaveBeenCalledOnce();
  });

  it('says so while the browser finds the host, and leaves the choice alone when it cannot', async () => {
    const onVenueInvalidate = vi.fn();
    const onUserGestureEnd = vi.fn();
    const browser = browserAsked();
    renderHostMap({ venue: CAFE, onVenueInvalidate, onUserGestureEnd });

    press('Locate me');
    expect(
      screen.getByText(LOCATING),
      'a precise fix takes seconds, long enough to read as a dead button',
    ).toBeTruthy();
    await settle(() => browser.refused());

    expect(screen.queryByText(LOCATING)).toBeNull();
    expect(screen.getByText(NO_LOCATION)).toBeTruthy();
    expect(reverse.mutateAsync).not.toHaveBeenCalled();
    expect(
      onVenueInvalidate,
      'the café already chosen stays chosen',
    ).not.toHaveBeenCalled();
    expect(
      onUserGestureEnd,
      'a host whose location is unknown keeps the search box',
    ).not.toHaveBeenCalled();
  });

  it('drops a position that arrives after the host tapped a spot themselves', async () => {
    const onUserGestureEnd = vi.fn();
    const browser = browserAsked();
    renderHostMap({ onUserGestureEnd });

    press('Locate me');
    fireEvent.click(screen.getByTestId('map-surface'));
    await settle(() => browser.found(HERE));

    expect(reverse.mutateAsync).toHaveBeenCalledOnce();
    expect(
      camera.flyTo,
      'the position arriving late took the host away from the spot they tapped',
    ).not.toHaveBeenCalled();
    expect(onUserGestureEnd).toHaveBeenCalledOnce();
  });

  it('drops a position that arrives after the host went on to the next step', async () => {
    const onVenueInvalidate = vi.fn();
    const browser = browserAsked();
    const { rerender } = renderHostMap({ venue: CAFE, onVenueInvalidate });

    press('Locate me');
    rerender(hostMap({ venue: CAFE, onVenueInvalidate, isInteractive: false }));
    await settle(() => browser.found(HERE));

    expect(
      onVenueInvalidate,
      'the café the host went on with was swapped for where they stood',
    ).not.toHaveBeenCalled();
    expect(reverse.mutateAsync).not.toHaveBeenCalled();
  });
});
