export const VENUE_ZOOM = 15;

export const LOCATE_ZOOM = 17;

const TAP_STEP = 2;

const SLACK = 0.01;

/**
 * Where a tap on the map at `zoom` takes it. Once the map is as close as it shows a chosen place,
 * nowhere (null): the tap picks the spot under it. From further out a fingertip covers a district,
 * and the address found under it would be a guess the host never made, so the map flies in to
 * street level instead, where the next tap can tell one building from the next.
 */
export const zoomForTap = (zoom: number): number | null =>
  zoom + SLACK >= VENUE_ZOOM
    ? null
    : Math.min(Math.max(zoom + TAP_STEP, VENUE_ZOOM), VENUE_ZOOM + 1);
