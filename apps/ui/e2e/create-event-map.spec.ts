import { expect, test, type Locator, type Page } from '@playwright/test';

import { LOCALE_DIRECTION, t, type E2eLocale } from './support/messages';
import { localeFor, watchForApplicationErrors } from './support/run';
import { useLocale, wizardPath } from './support/host-wizard';

type Box = { x: number; y: number; width: number; height: number };

const HOLD_STILL_MS = 300;
const SPOT_BELOW_PIN = 45;

const HOST_POSITION = { latitude: 36.7731, longitude: 3.0595 };

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

/** The wizard's step-1 controls, named as each locale names them. */
const venueControls = (page: Page, locale: E2eLocale) => ({
  search: page.getByRole('combobox', {
    name: t(locale, 'host_venue_search_label'),
    exact: true,
  }),
  searchButton: page.getByRole('button', {
    name: t(locale, 'host_search_venues'),
    exact: true,
  }),
  locate: page.getByRole('button', {
    name: t(locale, 'host_locate_me'),
    exact: true,
  }),
  nearby: page.getByRole('listbox', {
    name: t(locale, 'host_nearby_venues'),
    exact: true,
  }),
  choice: page.getByRole('group', {
    name: t(locale, 'host_selected_location'),
    exact: true,
  }),
  canvas: page.locator('.mapboxgl-canvas'),
});

/** Open the wizard and wait for its map and the places around it to be ready. */
const openWizard = async (page: Page, locale: E2eLocale, baseURL: string) => {
  await useLocale(page, locale, baseURL);
  await page.goto(wizardPath());
  const controls = venueControls(page, locale);
  await expect(controls.canvas).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText(t(locale, 'host_map_loading'))).toHaveCount(0, {
    timeout: 30_000,
  });
  await expect(controls.searchButton).toBeVisible({ timeout: 30_000 });
  await expect(controls.nearby.getByRole('option').first()).toBeVisible({
    timeout: 30_000,
  });
  return controls;
};

test.describe('the venue map below lg', () => {
  test('lists the places with no box to fill, gives the map back once the host works it, and searches from Search', async ({
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
    const { search, searchButton, locate, nearby, choice, canvas } =
      await openWizard(page, locale, baseURL as string);

    await expect(search).toHaveCount(0);
    const button = await boxOf(searchButton);
    const corner = await boxOf(locate);
    expect(Math.abs(button.height - corner.height)).toBeLessThanOrEqual(1);
    expect(Math.abs(button.y - corner.y)).toBeLessThanOrEqual(1);
    if (LOCALE_DIRECTION[locale] === 'rtl') {
      expect(button.x + button.width).toBeLessThan(corner.x);
    } else {
      expect(button.x).toBeGreaterThan(corner.x + corner.width);
    }
    expect(
      (await boxOf(nearby)).y,
      'the places hang below the row Locate me and Search share',
    ).toBeGreaterThan(corner.y + corner.height);
    await page.screenshot({ path: testInfo.outputPath('1-arrival.png') });
    const before = await boxOf(canvas);

    await dragMap(page, before);

    await expect(nearby).toBeHidden();
    await expect(search).toHaveCount(0);
    await expect(searchButton).toBeVisible();
    const after = await boxOf(canvas);
    expect(
      Math.abs(after.y - before.y) + Math.abs(after.height - before.height),
      'nothing in the page flow came or went, so the map stayed put',
    ).toBeLessThanOrEqual(1);
    await page.screenshot({ path: testInfo.outputPath('2-map.png') });

    await searchButton.click();
    await expect(search).toBeFocused();
    await expect(searchButton).toHaveCount(0);
    await expect(nearby.getByRole('option').first()).toBeVisible({
      timeout: 30_000,
    });
    await page.screenshot({ path: testInfo.outputPath('3-searching.png') });

    await nearby.getByRole('option').first().click();
    await expect(search, 'a place picked is a search done').toHaveCount(0);
    await expect(nearby).toBeHidden();
    await expect(choice).toBeVisible();
    const pin = await restingPin(page);
    await page.mouse.click(
      pin.x + pin.width / 2,
      pin.y + pin.height + SPOT_BELOW_PIN,
    );

    await expect(choice).toBeVisible({ timeout: 30_000 });
    await expect(search).toHaveCount(0);
    const nameField = page.locator('#host-venue-name');
    if (await nameField.isVisible()) {
      await nameField.fill('Café E2E');
      await expect(choice).toContainText('Café E2E');
    }
    await page.screenshot({ path: testInfo.outputPath('4-chosen.png') });
    expect(errors).toEqual([]);
  });
});

test.describe('the venue map from lg up', () => {
  test('keeps the places in the rail, and opens the box only from Search until the host works the map', async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) < 1024,
      'below lg the places float over the map',
    );
    test.setTimeout(150_000);
    const locale = localeFor(testInfo.project.name);
    const errors = watchForApplicationErrors(page);
    const { search, searchButton, nearby, canvas } = await openWizard(
      page,
      locale,
      baseURL as string,
    );

    await expect(
      search,
      'an empty box under the title read as a field to fill before Next',
    ).toHaveCount(0);
    await searchButton.click();
    await expect(search).toBeFocused();
    await expect(nearby).toBeVisible();

    await dragMap(page, await boxOf(canvas));

    await expect(search).toHaveCount(0);
    await expect(nearby).toBeVisible();
    await expect(searchButton).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath('rail.png') });
    expect(errors).toEqual([]);
  });
});

test.describe('Locate me on the venue map', () => {
  test.use({ geolocation: HOST_POSITION, permissions: ['geolocation'] });

  test('drops the pin where the host stands and asks what the place is called', async ({
    page,
    baseURL,
  }, testInfo) => {
    test.setTimeout(120_000);
    const locale = localeFor(testInfo.project.name);
    const errors = watchForApplicationErrors(page);
    const isOverMap = (page.viewportSize()?.width ?? 0) < 1024;
    const { search, searchButton, locate, choice, canvas } = await openWizard(
      page,
      locale,
      baseURL as string,
    );

    await locate.click();

    const nameField = page.locator('#host-venue-name');
    await expect(
      nameField,
      'the spot the host stands on is an address, and the host names it',
    ).toBeVisible({ timeout: 30_000 });
    const pin = await restingPin(page);
    const map = await boxOf(canvas);
    const tip = { x: pin.x + pin.width / 2, y: pin.y + pin.height };
    expect(tip.x).toBeGreaterThan(map.x);
    expect(tip.x).toBeLessThan(map.x + map.width);
    expect(tip.y).toBeGreaterThan(map.y);
    expect(tip.y).toBeLessThan(map.y + map.height);

    await expect(search).toHaveCount(0);
    await expect(searchButton).toBeVisible();
    if (isOverMap) await expect(choice).toBeVisible();
    await nameField.fill('Café E2E');
    if (isOverMap) await expect(choice).toContainText('Café E2E');
    await page.screenshot({ path: testInfo.outputPath('locate-me.png') });
    expect(errors).toEqual([]);
  });
});
