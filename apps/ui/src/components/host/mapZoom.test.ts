import { describe, expect, it } from 'vitest';

import { VENUE_ZOOM, zoomForTap } from './mapZoom';

describe('zoomForTap', () => {
  it.each([
    [10, VENUE_ZOOM],
    [13.5, VENUE_ZOOM + 0.5],
    [14.5, VENUE_ZOOM + 1],
  ])('flies a tap at zoom %d in to street level, %d', (zoom, closer) => {
    expect(zoomForTap(zoom)).toBe(closer);
  });

  it.each([VENUE_ZOOM, VENUE_ZOOM - 0.001, 17])(
    'lets a tap at zoom %d pick the spot under it',
    (zoom) => {
      expect(zoomForTap(zoom)).toBeNull();
    },
  );
});
