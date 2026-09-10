export const CALLOUT_GAP = 6;
export const CALLOUT_EDGE_PADDING = 12;
export const PIN_HEIGHT = 52;

/**
 * Whether the venue card fits between the pin's head and the top of the map.
 *
 * Checked before flipping: on a short map a card that will not fit either way stays below the pin,
 * where the clipped part is the hint rather than the venue's name.
 */
export const calloutFitsAbove = (
  pinY: number,
  calloutHeight: number,
): boolean =>
  pinY - PIN_HEIGHT - CALLOUT_GAP - calloutHeight - CALLOUT_EDGE_PADDING >= 0;

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
