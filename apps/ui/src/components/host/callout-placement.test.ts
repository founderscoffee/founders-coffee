import { describe, expect, it } from 'vitest';

import {
  CALLOUT_EDGE_PADDING,
  CALLOUT_GAP,
  calloutFitsAbove,
  calloutFitsBelow,
  PIN_HEIGHT,
} from './callout-placement';

const CARD_HEIGHT = 123;
const MAP_HEIGHT = 300;

describe('calloutFitsBelow', () => {
  it('keeps the card under the pin while there is room for it', () => {
    expect(calloutFitsBelow(40, MAP_HEIGHT, CARD_HEIGHT)).toBe(true);
  });

  it('flips the card above the pin once the bottom edge would clip it', () => {
    expect(calloutFitsBelow(220, MAP_HEIGHT, CARD_HEIGHT)).toBe(false);
  });

  it('treats the last pixel of breathing room as a fit', () => {
    const exact = MAP_HEIGHT - CARD_HEIGHT - CALLOUT_GAP - CALLOUT_EDGE_PADDING;

    expect(calloutFitsBelow(exact, MAP_HEIGHT, CARD_HEIGHT)).toBe(true);
    expect(calloutFitsBelow(exact + 1, MAP_HEIGHT, CARD_HEIGHT)).toBe(false);
  });

  it('flips a pin dragged past the bottom of the map', () => {
    expect(calloutFitsBelow(MAP_HEIGHT + 20, MAP_HEIGHT, CARD_HEIGHT)).toBe(
      false,
    );
  });
});

describe('calloutFitsAbove', () => {
  it('leaves room for the pin between the card and the coordinate', () => {
    const exact = PIN_HEIGHT + CALLOUT_GAP + CARD_HEIGHT + CALLOUT_EDGE_PADDING;

    expect(calloutFitsAbove(exact, CARD_HEIGHT)).toBe(true);
    expect(calloutFitsAbove(exact - 1, CARD_HEIGHT)).toBe(false);
  });

  it('refuses a pin too close to the top of the map', () => {
    expect(calloutFitsAbove(40, CARD_HEIGHT)).toBe(false);
  });
});
