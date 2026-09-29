export const CALLOUT_GAP = 6;
export const CALLOUT_EDGE_PADDING = 12;
export const PIN_HEIGHT = 52;

/**
 * Whether the venue card fits between the pin's head and the top of what can be seen of the map.
 *
 * Checked before flipping: on a short map a card that will not fit either way stays below the pin,
 * where the clipped part is the hint rather than the venue's name. `covered` is how far the venue
 * panel reaches down over the map below `lg`; a card under it is as hidden as one off the edge.
 */
export const calloutFitsAbove = (
  pinY: number,
  calloutHeight: number,
  covered = 0,
): boolean =>
  pinY - PIN_HEIGHT - CALLOUT_GAP - calloutHeight - CALLOUT_EDGE_PADDING >=
  covered;

/**
 * Whether the venue card still fits between the pin's tip and the bottom of the map.
 *
 * The card hangs under the pin so the two read as one object rather than two pieces of chrome.
 * Near the bottom edge that would clip it, so the caller flips it above the pin instead. The
 * decision is taken from the pin's projected pixel position, not its coordinates, because what
 * matters is room on screen at the current zoom.
 */
export const calloutFitsBelow = (
  pinY: number,
  mapHeight: number,
  calloutHeight: number,
): boolean =>
  pinY + CALLOUT_GAP + calloutHeight + CALLOUT_EDGE_PADDING <= mapHeight;

/**
 * How far the venue card slides sideways from being centred on the pin, so that none of it
 * leaves the map.
 *
 * Centred on a pin near either side of the map, the card runs off it and loses the start of the
 * venue's name and of the hint. It slides back in until it clears that side by the edge padding,
 * but never so far that the pin's tip ends up more than that padding beyond the card's side. So
 * while the tip is on the map the whole card is too, and a pin panned off the map takes its card
 * along instead of stranding it at the edge. Positions are physical pixels from the map's left
 * edge, as Mapbox projects them, so a right-to-left page needs nothing different.
 */
export const calloutShift = (
  pinX: number,
  mapWidth: number,
  calloutWidth: number,
): number => {
  const centred = pinX - calloutWidth / 2;
  const onMap = Math.min(
    Math.max(centred, CALLOUT_EDGE_PADDING),
    mapWidth - CALLOUT_EDGE_PADDING - calloutWidth,
  );
  const byPin = Math.min(
    Math.max(onMap, pinX - calloutWidth - CALLOUT_EDGE_PADDING),
    pinX + CALLOUT_EDGE_PADDING,
  );
  return byPin - centred;
};
