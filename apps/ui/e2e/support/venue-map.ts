import { expect, type Locator, type Page } from '@playwright/test';

import { t, type E2eLocale } from './messages';

type Point = { x: number; y: number };
type Box = Point & { width: number; height: number };

const SPOT_BELOW_PIN = 45;
const GRIP_BELOW_TIP = 30;
const HOLD_STILL_MS = 300;

/**
 * The box a map part is drawn in, failing the test when it is not drawn at all.
 */
export const boxOf = async (locator: Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  if (!box) throw new Error('expected the map part to be laid out');
  return box;
};

/**
 * Where a pin drawn in `pin` has its tip, which is the point the host chose.
 */
const tipOf = (pin: Box): Point => ({
  x: pin.x + pin.width / 2,
  y: pin.y + pin.height,
});

export const venueMap = (page: Page): Locator =>
  page.locator('.mapboxgl-canvas');

const venuePin = (page: Page): Locator => page.locator('svg.host-pin');

/**
 * The card over the pin, found by the eyebrow that names it and read as the card itself rather
 * than the marker Mapbox wraps it in.
 */
export const venueCallout = (page: Page, locale: E2eLocale): Locator =>
  page
    .locator('.mapboxgl-marker')
    .filter({ hasText: t(locale, 'host_selected_location') })
    .locator(':scope > div');

/**
 * Hold the callout to the map `map` draws: all of it inside the map, the pin's tip over it, and
 * the pin itself left uncovered, whether the callout hangs below the pin or has flipped above it.
 */
export const expectCalloutOnMap = async (
  page: Page,
  locale: E2eLocale,
  map: Box,
  where: string,
): Promise<void> => {
  const card = await boxOf(venueCallout(page, locale));
  const pin = await boxOf(venuePin(page));
  const tip = tipOf(pin);

  expect(card.x, `by ${where}, the callout's left side`).toBeGreaterThanOrEqual(
    map.x,
  );
  expect(
    card.x + card.width,
    `by ${where}, the callout's right side`,
  ).toBeLessThanOrEqual(map.x + map.width);
  expect(card.y, `by ${where}, the callout's top`).toBeGreaterThanOrEqual(
    map.y,
  );
  expect(
    card.y + card.height,
    `by ${where}, the callout's bottom`,
  ).toBeLessThanOrEqual(map.y + map.height);
  expect(
    tip.x,
    `by ${where}, the pin stands over its callout`,
  ).toBeGreaterThanOrEqual(card.x);
  expect(
    tip.x,
    `by ${where}, the pin stands over its callout`,
  ).toBeLessThanOrEqual(card.x + card.width);
  expect(
    card.y >= tip.y || card.y + card.height <= pin.y,
    `by ${where}, the callout leaves the pin uncovered`,
  ).toBe(true);
};

/**
 * Where the pin's tip stands once the map has stopped moving it. Opening the venue list again
 * below `lg` can ease the map to bring the pin out from under the list.
 */
export const restingTip = async (page: Page): Promise<Point> => {
  const reads: Point[] = [];
  await expect
    .poll(
      async () => {
        const pin = await venuePin(page).boundingBox();
        if (!pin) return false;
        reads.push(tipOf(pin));
        const [before, now] = reads.slice(-2);
        return reads.length > 1 && before.x === now.x && before.y === now.y;
      },
      {
        intervals: [250],
        message: 'the map should come to rest under the pin',
      },
    )
    .toBe(true);
  return reads[reads.length - 1];
};

/**
 * Whether the pin's tip stands on `point`, to the pixel Mapbox rounds a marker to.
 */
const isPinAt = async (page: Page, point: Point): Promise<boolean> => {
  const pin = await venuePin(page).boundingBox();
  if (!pin) return false;
  const tip = tipOf(pin);
  return Math.abs(tip.x - point.x) < 2 && Math.abs(tip.y - point.y) < 2;
};

/**
 * Tap `spot` on the venue map, as a host chooses a place, and wait until the callout names it.
 *
 * Mapbox resolves a tap only where it knows an address, and which streets it knows can change from
 * one run to the next, so the place already chosen, which Mapbox did resolve, is first dragged to
 * just above `spot`: a tap that close to it resolves too. The map is gripped under the pin's tip,
 * clear of the pin, and held still before it is let go, because Mapbox glides on after a drag
 * that was still moving when it ended.
 */
export const chooseSpot = async (
  page: Page,
  locale: E2eLocale,
  spot: Point,
): Promise<void> => {
  const chosen = { x: spot.x, y: spot.y - SPOT_BELOW_PIN };
  const tip = tipOf(await boxOf(venuePin(page)));
  await page.mouse.move(tip.x, tip.y + GRIP_BELOW_TIP);
  await page.mouse.down();
  await page.mouse.move(chosen.x, chosen.y + GRIP_BELOW_TIP, { steps: 12 });
  await page.waitForTimeout(HOLD_STILL_MS);
  await page.mouse.up();
  await expect
    .poll(() => isPinAt(page, chosen), {
      message:
        'the drag should leave the place already chosen just above the spot',
    })
    .toBe(true);

  await page.mouse.click(spot.x, spot.y);
  await expect
    .poll(
      async () =>
        (await isPinAt(page, spot)) &&
        (await venueCallout(page, locale).isVisible()),
      {
        message:
          'a tap this close to a place Mapbox resolved should resolve too',
        timeout: 30_000,
      },
    )
    .toBe(true);
};
