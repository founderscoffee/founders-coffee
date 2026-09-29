import { describe, expect, it } from 'vitest';

import {
  CALLOUT_EDGE_PADDING,
  CALLOUT_GAP,
  calloutFitsAbove,
  calloutFitsBelow,
  calloutShift,
  PIN_HEIGHT,
} from './callout-placement';

const CARD_HEIGHT = 123;
const MAP_HEIGHT = 300;
const CARD_WIDTH = 256;
const MAP_WIDTH = 375;

const cardSides = (
  pinX: number,
  mapWidth = MAP_WIDTH,
  cardWidth = CARD_WIDTH,
) => {
  const left = pinX - cardWidth / 2 + calloutShift(pinX, mapWidth, cardWidth);
  return { left, right: left + cardWidth };
};

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

  it('counts the panel over the top of the map as no room at all', () => {
    const clear = PIN_HEIGHT + CALLOUT_GAP + CARD_HEIGHT + CALLOUT_EDGE_PADDING;
    const covered = 180;

    expect(
      calloutFitsAbove(clear, CARD_HEIGHT, covered),
      'below lg the venue list floats over the top of the map, and a card flipped under it would hide the venue it names',
    ).toBe(false);
    expect(calloutFitsAbove(clear + covered, CARD_HEIGHT, covered)).toBe(true);
  });
});

describe('calloutShift', () => {
  it('leaves the card centred on a pin with room on both sides', () => {
    expect(calloutShift(MAP_WIDTH / 2, MAP_WIDTH, CARD_WIDTH)).toBe(0);
  });

  it('slides the card clear of the left edge for a pin tapped near it', () => {
    expect(cardSides(60)).toEqual({
      left: CALLOUT_EDGE_PADDING,
      right: CALLOUT_EDGE_PADDING + CARD_WIDTH,
    });
  });

  it('slides the card clear of the right edge for a pin tapped near it', () => {
    expect(cardSides(MAP_WIDTH - 60)).toEqual({
      left: MAP_WIDTH - CALLOUT_EDGE_PADDING - CARD_WIDTH,
      right: MAP_WIDTH - CALLOUT_EDGE_PADDING,
    });
  });

  it('starts sliding at the pixel where the card would cross the edge padding', () => {
    const lastCentred = CALLOUT_EDGE_PADDING + CARD_WIDTH / 2;

    expect(calloutShift(lastCentred, MAP_WIDTH, CARD_WIDTH)).toBe(0);
    expect(calloutShift(lastCentred - 1, MAP_WIDTH, CARD_WIDTH)).toBe(1);
    expect(calloutShift(MAP_WIDTH - lastCentred, MAP_WIDTH, CARD_WIDTH)).toBe(
      0,
    );
    expect(
      calloutShift(MAP_WIDTH - lastCentred + 1, MAP_WIDTH, CARD_WIDTH),
    ).toBe(-1);
  });

  it('keeps the whole card on the map and tied to the pin, wherever on the map the pin is', () => {
    const maps = [
      { mapWidth: 320, cardWidth: 0.7 * 320 },
      { mapWidth: 375, cardWidth: CARD_WIDTH },
      { mapWidth: 768, cardWidth: CARD_WIDTH },
      { mapWidth: 800, cardWidth: CARD_WIDTH },
    ];
    const misplaced = maps.flatMap(({ mapWidth, cardWidth }) =>
      Array.from({ length: mapWidth + 1 }, (_, pinX) => pinX)
        .filter((pinX) => {
          const { left, right } = cardSides(pinX, mapWidth, cardWidth);
          return (
            left < CALLOUT_EDGE_PADDING ||
            right > mapWidth - CALLOUT_EDGE_PADDING ||
            pinX < left - CALLOUT_EDGE_PADDING ||
            pinX > right + CALLOUT_EDGE_PADDING
          );
        })
        .map((pinX) => ({ mapWidth, pinX })),
    );

    expect(
      misplaced,
      'from a 320px phone, where the card narrows to 70vw, to the map beside the desktop rail',
    ).toEqual([]);
  });

  it('takes the card along with a pin panned off either side of the map', () => {
    expect(
      cardSides(-40).left,
      'a card held at the edge after its pin has gone would name a place the host cannot see',
    ).toBe(-40 + CALLOUT_EDGE_PADDING);
    expect(cardSides(MAP_WIDTH + 40).right).toBe(
      MAP_WIDTH + 40 - CALLOUT_EDGE_PADDING,
    );
  });
});
