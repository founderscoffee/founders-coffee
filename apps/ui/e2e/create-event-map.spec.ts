import { expect, test, type Locator, type Page } from '@playwright/test';

import { LOCALE_DIRECTION, t } from './support/messages';
import { localeFor, watchForApplicationErrors } from './support/run';
import { useLocale, wizardPath } from './support/host-wizard';

type Box = { x: number; y: number; width: number; height: number };

const HOLD_STILL_MS = 300;
const SPOT_BELOW_PIN = 45;

/** The box `locator` is drawn in, failing the test when it is not drawn at all. */
const boxOf = async (locator: Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  if (!box) throw new Error('expected the element to be laid out');
  return box;
};

/**
 * Drag the map from below its middle and let go, as a host looking around does. The finger is
 * held still before it lifts, because Mapbox glides on after a drag still moving when it ended.
 */
const dragMap = async (page: Page, map: Box): Promise<void> => {
  const grip = { x: map.x + map.width / 2, y: map.y + map.height * 0.7 };
  await page.mouse.move(grip.x, grip.y);
  await page.mouse.down();
  await page.mouse.move(grip.x + 40, grip.y - 30, { steps: 12 });
  await page.waitForTimeout(HOLD_STILL_MS);
  await page.mouse.up();
};

/** Where the pin stands once the map has stopped carrying it, polled until two reads agree. */
const restingPin = async (page: Page): Promise<Box> => {
  const reads: Box[] = [];
  await expect
    .poll(
      async () => {
        const pin = await page.locator('svg.host-pin').boundingBox();
        if (!pin) return false;
        reads.push(pin);
        const [before, now] = reads.slice(-2);
        return reads.length > 1 && before.x === now.x && before.y === now.y;
      },
      { intervals: [250], message: 'the map should come to rest' },
    )
    .toBe(true);
  return reads[reads.length - 1];
};

test.describe('the venue map below lg', () => {
  test('gives the search box’s place to the choice once the host lets go of the map, and brings it back from Search', async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) >= 1024,
      'from lg up the list has a rail of its own beside the map',
    );
    test.setTimeout(150_000);
    const locale = localeFor(testInfo.project.name);
    const errors = watchForApplicationErrors(page);
    await useLocale(page, locale, baseURL as string);
    await page.goto(wizardPath());

    const search = page.getByRole('combobox', {
      name: t(locale, 'host_venue_search_label'),
      exact: true,
    });
    const searchButton = page.getByRole('button', {
      name: t(locale, 'host_search_venues'),
      exact: true,
    });
    const locate = page.getByRole('button', {
      name: t(locale, 'host_locate_me'),
      exact: true,
    });
    const nearby = page.getByRole('listbox', {
      name: t(locale, 'host_nearby_venues'),
      exact: true,
    });
    const canvas = page.locator('.mapboxgl-canvas');
    await expect(search).toBeEnabled({ timeout: 30_000 });
    await expect(canvas).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(t(locale, 'host_map_loading'))).toHaveCount(0, {
      timeout: 30_000,
    });
    await expect(nearby.getByRole('option').first()).toBeVisible({
      timeout: 30_000,
    });
    const before = await boxOf(canvas);

    await dragMap(page, before);

    await expect(searchButton).toBeVisible({ timeout: 10_000 });
    await expect(search).toHaveCount(0);
    await expect(
      page.getByText(t(locale, 'host_venue_empty'), { exact: true }),
    ).toBeVisible();
    const after = await boxOf(canvas);
    expect(
      Math.abs(after.y - before.y) + Math.abs(after.height - before.height),
      'the line in the search box’s place is as tall as the box, so the map stays put',
    ).toBeLessThanOrEqual(1);
    const button = await boxOf(searchButton);
    const corner = await boxOf(locate);
    expect(Math.abs(button.height - corner.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(button.y - corner.y)).toBeLessThanOrEqual(1);
    if (LOCALE_DIRECTION[locale] === 'rtl') {
      expect(button.x + button.width).toBeLessThan(corner.x);
    } else {
      expect(button.x).toBeGreaterThan(corner.x + corner.width);
    }
    await page.screenshot({ path: testInfo.outputPath('1-exploring.png') });

    await searchButton.click();
    await expect(search).toBeVisible();
    await expect(search).toBeFocused();
    await expect(searchButton).toHaveCount(0);
    await expect(nearby.getByRole('option').first()).toBeVisible({
      timeout: 30_000,
    });
    await page.screenshot({ path: testInfo.outputPath('2-searching.png') });

    await nearby.getByRole('option').first().click();
    await expect(
      search,
      'a place picked from the list is a search that worked: the box stays',
    ).toBeVisible();
    const pin = await restingPin(page);
    await page.mouse.click(
      pin.x + pin.width / 2,
      pin.y + pin.height + SPOT_BELOW_PIN,
    );

    const choice = page.getByRole('group', {
      name: t(locale, 'host_selected_location'),
      exact: true,
    });
    await expect(choice).toBeVisible({ timeout: 30_000 });
    await expect(search).toHaveCount(0);
    const nameField = page.locator('#host-venue-name');
    if (await nameField.isVisible()) {
      await nameField.fill('Café E2E');
      await expect(choice).toContainText('Café E2E');
    }
    await page.screenshot({ path: testInfo.outputPath('3-chosen.png') });
    expect(errors).toEqual([]);
  });
});
