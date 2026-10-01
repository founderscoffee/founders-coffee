import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
