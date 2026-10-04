import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { VenueSelection } from '../../features/events/types';
import {
  CAFE,
  camera,
  ELSEWHERE,
  flewTo,
  hostMap as map,
  press,
  renderHostMap as renderMap,
  reverse,
  STREET,
} from './HostMap.fixtures';

beforeEach(() => {
  camera.zoom = 16;
  reverse.mutateAsync.mockReturnValue(new Promise(() => undefined));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('HostMap telling the page the host let go of it', () => {
  it('reports the end of a move the host made, once, and of no move the map made itself', () => {
    const onUserMove = vi.fn();
    const onUserGestureEnd = vi.fn();
    const onCenterChange = vi.fn();
    renderMap({ onUserMove, onUserGestureEnd, onCenterChange });

    press('map flies');
    press('move ends');
    expect(
      onUserGestureEnd,
      'flying to a café picked from the list is the map moving, not the host letting go of it',
    ).not.toHaveBeenCalled();

    press('host drags');
    expect(onUserMove).toHaveBeenCalledOnce();
    expect(
      onUserGestureEnd,
      'the drag is still under way: ending it now would change the page under the finger',
    ).not.toHaveBeenCalled();

    press('move ends');
    press('move ends');
    expect(onUserGestureEnd).toHaveBeenCalledOnce();
    expect(onCenterChange).toHaveBeenCalledTimes(3);
  });

  it('counts a tap that chooses a spot and a pin the host moved as letting go of the map', () => {
    const onUserGestureEnd = vi.fn();
    renderMap({ venue: CAFE, onUserGestureEnd });

    fireEvent.click(screen.getByTestId('map-surface'));
    expect(onUserGestureEnd).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByTestId('map-marker'));
    expect(onUserGestureEnd).toHaveBeenCalledTimes(2);
  });

  it('reports no tap or pin from a map the host cannot change', () => {
    const onUserGestureEnd = vi.fn();
    renderMap({ venue: CAFE, isInteractive: false, onUserGestureEnd });

    fireEvent.click(screen.getByTestId('map-surface'));
    fireEvent.click(screen.getByTestId('map-marker'));

    expect(onUserGestureEnd).not.toHaveBeenCalled();
  });
});

const DRAGGED_TO = { latitude: 36.76, longitude: 3.07 };

const MOVED: VenueSelection = { ...ELSEWHERE, ...DRAGGED_TO };

const deferredVenue = () => {
  let settle: ((venue: VenueSelection) => void) | undefined;
  const promise = new Promise<VenueSelection>((resolve) => {
    settle = resolve;
  });
  return {
    promise,
    resolve: (venue: VenueSelection) => settle?.(venue),
  };
};

describe('HostMap looking up the spot the host chose', () => {
  it('normalizes map-click selection through the reverse-venue hook', async () => {
    reverse.mutateAsync.mockResolvedValueOnce(CAFE);
    const onVenueSelect = vi.fn();
    const onVenueInvalidate = vi.fn();
    renderMap({ cityCode: '1', onVenueSelect, onVenueInvalidate });

    fireEvent.click(screen.getByTestId('map-surface'));

    expect(onVenueInvalidate).toHaveBeenCalledOnce();
    expect(reverse.mutateAsync).toHaveBeenCalledWith({
      marketCode: 'DZ',
      cityCode: '1',
      locale: 'en',
      latitude: CAFE.latitude,
      longitude: CAFE.longitude,
    });
    await waitFor(() =>
      expect(onVenueSelect).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: CAFE.providerId }),
      ),
    );
  });

  it('invalidates stale venue data and resolves a dragged marker again', async () => {
    reverse.mutateAsync.mockResolvedValueOnce(MOVED);
    const onVenueSelect = vi.fn();
    const onVenueInvalidate = vi.fn();
    renderMap({ venue: CAFE, cityCode: '1', onVenueSelect, onVenueInvalidate });

    fireEvent.click(screen.getByTestId('map-marker'));

    expect(onVenueInvalidate).toHaveBeenCalledOnce();
    expect(reverse.mutateAsync).toHaveBeenCalledWith({
      marketCode: 'DZ',
      cityCode: '1',
      locale: 'en',
      ...DRAGGED_TO,
    });
    await waitFor(() => expect(onVenueSelect).toHaveBeenCalledWith(MOVED));
  });

  it('ignores an older reverse lookup that finishes after a newer selection', async () => {
    const firstLookup = deferredVenue();
    const secondLookup = deferredVenue();
    reverse.mutateAsync
      .mockReturnValueOnce(firstLookup.promise)
      .mockReturnValueOnce(secondLookup.promise);
    const onVenueSelect = vi.fn();
    renderMap({ onVenueSelect });

    fireEvent.click(screen.getByTestId('map-surface'));
    fireEvent.click(screen.getByTestId('map-surface'));
    secondLookup.resolve(MOVED);
    await waitFor(() =>
      expect(onVenueSelect).toHaveBeenCalledWith(
        expect.objectContaining({ providerId: MOVED.providerId }),
      ),
    );

    firstLookup.resolve(CAFE);
    await firstLookup.promise;
    await waitFor(() => expect(onVenueSelect).toHaveBeenCalledOnce());
  });
});

describe('HostMap after a tap on the map', () => {
  it('flies to a place picked from the list after a tap that found nothing there', async () => {
    reverse.mutateAsync.mockRejectedValueOnce(new Error('unsupported'));
    const { rerender } = renderMap();
    fireEvent.click(screen.getByTestId('map-surface'));
    await screen.findByText('Could not load the venue map.');

    rerender(map({ venue: ELSEWHERE }));

    expect(
      camera.flyTo,
      'the failed tap was still counted as the host placing the next place, so a café picked from the list stayed off screen',
    ).toHaveBeenCalledWith(flewTo(ELSEWHERE, 15));
  });

  it('leaves the camera where it is for the spot the host tapped', async () => {
    reverse.mutateAsync.mockResolvedValueOnce(STREET);
    const onVenueSelect = vi.fn();
    const { rerender } = renderMap({ onVenueSelect });
    fireEvent.click(screen.getByTestId('map-surface'));
    await waitFor(() => expect(onVenueSelect).toHaveBeenCalledOnce());

    rerender(map({ onVenueSelect, venue: onVenueSelect.mock.calls[0][0] }));

    expect(camera.flyTo).not.toHaveBeenCalled();
  });

  it('flies to a place picked while a tapped spot is still being looked up, and drops that lookup', async () => {
    let settle: (venue: typeof STREET) => void = () => undefined;
    reverse.mutateAsync.mockReturnValueOnce(
      new Promise((resolve) => {
        settle = resolve;
      }),
    );
    const onVenueSelect = vi.fn();
    const { rerender } = renderMap({ onVenueSelect });
    fireEvent.click(screen.getByTestId('map-surface'));

    rerender(map({ onVenueSelect, venue: ELSEWHERE }));
    expect(camera.flyTo).toHaveBeenCalledWith(flewTo(ELSEWHERE, 15));

    settle(STREET);
    await Promise.resolve();
    await Promise.resolve();
    expect(
      onVenueSelect,
      'the lookup finishing late put the tapped spot back over the place picked after it',
    ).not.toHaveBeenCalled();
  });
});

describe('HostMap tapped from afar', () => {
  it('flies in on the spot tapped instead of guessing the address under a fingertip', () => {
    camera.zoom = 10;
    const onUserGestureEnd = vi.fn();
    const onVenueInvalidate = vi.fn();
    renderMap({ venue: CAFE, onUserGestureEnd, onVenueInvalidate });

    fireEvent.click(screen.getByTestId('map-surface'));

    expect(camera.flyTo).toHaveBeenCalledWith(flewTo(CAFE, 15));
    expect(
      reverse.mutateAsync,
      'from the whole city, a tap looked up whatever address lay under it and called that the place',
    ).not.toHaveBeenCalled();
    expect(onVenueInvalidate).not.toHaveBeenCalled();
    expect(
      onUserGestureEnd,
      'a tap is the host working the map, so the map is theirs',
    ).toHaveBeenCalledOnce();
  });

  it('picks the spot tapped once the map is as close as it shows a place chosen', () => {
    camera.zoom = 15;
    renderMap();

    fireEvent.click(screen.getByTestId('map-surface'));

    expect(reverse.mutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        latitude: CAFE.latitude,
        longitude: CAFE.longitude,
      }),
    );
    expect(camera.flyTo).not.toHaveBeenCalled();
  });
});
