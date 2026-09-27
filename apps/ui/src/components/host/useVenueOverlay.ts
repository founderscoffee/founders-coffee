import { useState } from 'react';

import type { ControlSize } from './useControlSize';

/**
 * The venue panel below `lg`, where it floats over the top of the map: open, or folded to its
 * header, and how much of the map it covers.
 *
 * It folds when the host takes hold of the map, picks a place from the list or touches anything
 * outside it, and opens again for anything they then have to read in it: what they searched for,
 * or why Next would not go on. A place chosen on the map leaves it folded, since the callout over
 * the pin already names it.
 * Folding only counts while the panel covers the map; from `lg` up the list sits beside the map
 * and is always open. Locate me stays in the map's top corner: an open list covers it, and a
 * folded or empty panel shares its row, so the panel is told the button's size.
 */
export const useVenueOverlay = () => {
  const [isFolded, setIsFolded] = useState(false);
  const [covered, setCovered] = useState(0);
  const [locate, setLocate] = useState<ControlSize | null>(null);
  const isCovering = covered > 0;
  const fold = () => {
    if (isCovering) setIsFolded(true);
  };

  return {
    covered,
    panel: {
      isCollapsed: isFolded && isCovering,
      neighbour: locate,
      onToggle: () => setIsFolded((folded) => !folded),
      onCoverChange: setCovered,
      onDismiss: fold,
    },
    onLocateResize: (size: ControlSize | null) =>
      setLocate((previous) =>
        previous?.width === size?.width && previous?.height === size?.height
          ? previous
          : size,
      ),
    open: () => setIsFolded(false),
    fold,
  };
};
