import { useState } from 'react';

import { VENUE_SEARCH_INPUT_ID } from '../../features/events/types';
import type { ControlSize } from './useControlSize';

/**
 * The venue panel below `lg`, where it floats over the top of the map: open, folded to its
 * header, or put away while the host works the map, and how much of the map it covers.
 *
 * It folds when the host takes hold of the map, picks a place from the list or touches anything
 * outside it, and opens again for anything they then have to read in it: what they searched for,
 * or the places to choose from when Next finds none chosen. A place chosen on the map leaves it
 * folded, since the pin shows where it is. The name an address needs is asked below the search
 * box, outside the panel, so a missing one does not open it.
 * Once the host lets go of the map (a drag or a zoom they made, a tap that chooses a spot, a pin
 * they moved, Locate me placing the pin where they are) they have picked the map over the search
 * box: the box gives way to a line naming the place chosen, at the box's own height so the map
 * does not move, and the panel to a search button beside Locate me. Not while they are typing in
 * the box, and not at the start of a drag, where the change would land under their finger. The
 * search button, a city switch or Next finding nothing chosen bring the box back with the list
 * open.
 * Folding and putting away only count while the panel covers the map; from `lg` up the list sits
 * beside the map and is always open. Locate me stays in the map's top corner: an open list covers
 * it, and a folded or headerless panel shares its row, so the panel is told the button's size.
 */
export const useVenueOverlay = () => {
  const [isFolded, setIsFolded] = useState(false);
  const [isExploring, setIsExploring] = useState(false);
  const [covered, setCovered] = useState(0);
  const [locate, setLocate] = useState<ControlSize | null>(null);
  const isCovering = covered > 0;
  const fold = () => {
    if (isCovering) setIsFolded(true);
  };
  const open = () => {
    setIsFolded(false);
    setIsExploring(false);
  };
  const explore = () => {
    if (!isCovering) return;
    if (document.activeElement?.id === VENUE_SEARCH_INPUT_ID) return;
    setIsFolded(true);
    setIsExploring(true);
  };

  return {
    covered,
    panel: {
      isCollapsed: isFolded && isCovering,
      isExploring: isExploring && isCovering,
      neighbour: locate,
      onToggle: () => setIsFolded((folded) => !folded),
      onCoverChange: setCovered,
      onDismiss: fold,
      onSearch: open,
    },
    map: {
      onUserMove: fold,
      onUserGestureEnd: explore,
      onLocateResize: (size: ControlSize | null) =>
        setLocate((previous) =>
          previous?.width === size?.width && previous?.height === size?.height
            ? previous
            : size,
        ),
    },
    open,
  };
};
