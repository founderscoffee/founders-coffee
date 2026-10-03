import { useState } from 'react';
import { flushSync } from 'react-dom';

import { seekField } from '../../features/events/seek-field';
import {
  VENUE_LIST_ID,
  VENUE_SEARCH_INPUT_ID,
} from '../../features/events/types';
import type { ControlSize } from './useControlSize';

const ROW_TOP = 12;

/**
 * How the venue step stands around the map: whether the search box is open, whether the places
 * are listed over the map below `lg`, and how much of the map's top they hide from the camera.
 *
 * The box opens only when the host asks for it, from Search on the map. Open on arrival, the empty
 * box read as a field to fill before Next, and the provider names almost no cafés in Algeria: the
 * places nearby and the map are where hosts find theirs. Below `lg` those places float over the
 * map on arrival. Once the host works the map (a drag, a zoom, a tap, a pin moved, Locate me) or
 * picks a place, the box and the list give the map back, and only the place chosen stays over it.
 * Search opens both again with the cursor in the box, and a city switch lists the places. Next
 * finding nothing chosen says nothing: it lists them too and takes the host to the first, or opens
 * the search where there is none to offer. From `lg` up the places keep their rail beside the map,
 * so only the box comes and goes there.
 *
 * Locate me and Search share the map's top row. The panel hangs below that row, and the camera
 * keeps a pin clear of both, so the row's height is measured from Locate me.
 */
export const useVenueOverlay = () => {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isListOpen, setIsListOpen] = useState(true);
  const [panelCovered, setPanelCovered] = useState(0);
  const [row, setRow] = useState<ControlSize | null>(null);
  const showMap = () => {
    setIsSearchOpen(false);
    setIsListOpen(false);
  };
  const openSearch = () => {
    flushSync(() => {
      setIsSearchOpen(true);
      setIsListOpen(true);
    });
    document.getElementById(VENUE_SEARCH_INPUT_ID)?.focus();
  };
  const offerPlaces = () => {
    flushSync(() => setIsListOpen(true));
    const place = document.querySelector<HTMLElement>(
      `#${VENUE_LIST_ID} [role="option"][tabindex="0"]`,
    );
    if (place) seekField(place);
    else openSearch();
  };

  return {
    covered: Math.max(panelCovered, row ? row.height + ROW_TOP : 0),
    isSearchOpen,
    panel: { isSearchOpen, isListOpen, row, onCoverChange: setPanelCovered },
    map: {
      onUserMove: showMap,
      onUserGestureEnd: showMap,
      onLocateResize: (size: ControlSize | null) =>
        setRow((previous) =>
          previous?.width === size?.width && previous?.height === size?.height
            ? previous
            : size,
        ),
    },
    showMap,
    openSearch,
    offerPlaces,
    listPlaces: () => setIsListOpen(true),
  };
};
