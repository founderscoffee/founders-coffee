import { expect, test, type Page } from '@playwright/test';

import { LOCALE_DIRECTION, type E2eLocale } from './support/messages';
import { localeFor } from './support/run';
import {
  HOST_VENUE_NAME,
  VENUE_QUERY,
  continueToLoginButton,
  nextButton,
  selectSchedule,
  selectVenue,
  useLocale,
  wizardPath,
} from './support/host-wizard';

/**
 * Measure a field's counter against the field above it and the error below it, in one layout
 * pass.
 *
 * `endGap` is how far the counter's text stops short of the field's inline end in the locale's
 * own direction, so an end-aligned counter reads 0 in Arabic as in French. `errorGap` is the
 * error's top less the counter's bottom, which goes negative when the error runs on inside the
 * counter's line.
 */
const measureCounter = (
  page: Page,
  locale: E2eLocale,
  field: string,
): Promise<{ endGap: number; errorGap: number }> =>
  page.evaluate(
    ({ id, note, direction }) => {
      const element = (suffix: string) => {
        const found = document.getElementById(`${id}${suffix}`);
        if (!found) throw new Error(`#${id}${suffix} is not on the page`);
        return found;
      };
      const box = element('').getBoundingClientRect();
      const text = document.createRange();
      text.selectNodeContents(element(note));
      const line = text.getBoundingClientRect();
      return {
        endGap:
          direction === 'rtl' ? line.left - box.left : box.right - line.right,
        errorGap:
          element('-error').getBoundingClientRect().top -
          element(note).getBoundingClientRect().bottom,
      };
    },
    { id: field, note: '-count', direction: LOCALE_DIRECTION[locale] },
  );

test.describe('create event field layout', () => {
  test('ends each counter at its field and gives each error a line of its own', async ({
    page,
    baseURL,
  }, testInfo) => {
    test.setTimeout(120_000);
    const locale = localeFor(testInfo.project.name);
    await useLocale(page, locale, baseURL as string);
    await page.goto(wizardPath());

    await selectVenue(page, locale, VENUE_QUERY);
    const venueName = page.locator('#host-venue-name');
    const venueNameError = page.locator('#host-venue-name-error');
    await expect(venueName).toBeVisible();
    await venueName.fill('');
    await nextButton(page, locale).click();
    await expect(
      venueName,
      'Next takes the host to the name still missing, without a word',
    ).toBeFocused();
    await expect(venueNameError).toHaveCount(0);

    await venueName.fill('K');
    await nextButton(page, locale).click();
    await expect(venueNameError).toBeVisible();
    const nameBox = await venueName.boundingBox();
    const nameErrorBox = await venueNameError.boundingBox();
    expect(
      (nameErrorBox?.y ?? 0) - ((nameBox?.y ?? 0) + (nameBox?.height ?? 0)),
      'the venue name error starts below its field',
    ).toBeGreaterThanOrEqual(0);

    await venueName.fill(HOST_VENUE_NAME);
    await nextButton(page, locale).click();
    await selectSchedule(page);
    await nextButton(page, locale).click();
    await continueToLoginButton(page, locale).click();
    await expect(
      page.locator('#host-title'),
      'Next takes the host to the title still to write, without a word',
    ).toBeFocused();
    await expect(page.locator('#host-title-error')).toHaveCount(0);

    await page.locator('#host-title').fill('x');
    await page.locator('#host-description').fill('Too short');
    await continueToLoginButton(page, locale).click();

    for (const field of ['host-title', 'host-description']) {
      await expect(page.locator(`#${field}-error`)).toBeVisible();
      const counter = await measureCounter(page, locale, field);
      expect(
        Math.abs(counter.endGap),
        `#${field}'s counter ends where the field does`,
      ).toBeLessThanOrEqual(1);
      expect(
        counter.errorGap,
        `#${field}'s error starts below its counter`,
      ).toBeGreaterThanOrEqual(0);
    }
  });
});
