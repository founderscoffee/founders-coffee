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
 * Measure a field's note against the field above it and the error below it, in one layout pass.
 *
 * `endGap` is how far the note's text stops short of the field's inline end in the locale's own
 * direction, so an end-aligned counter reads 0 in Arabic as in French. `errorGap` is the error's
 * top less the note's bottom, which goes negative when the error runs on inside the note's line.
 */
const measureNote = (
  page: Page,
  locale: E2eLocale,
  field: string,
  kind: 'count' | 'help',
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
    { id: field, note: `-${kind}`, direction: LOCALE_DIRECTION[locale] },
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
    await expect(venueName).toBeVisible();
    await venueName.fill('');
    await nextButton(page, locale).click();
    await expect(page.locator('#host-venue-name-error')).toBeVisible();
    const helper = await measureNote(page, locale, 'host-venue-name', 'help');
    expect(
      helper.errorGap,
      'the venue name error starts below the helper',
    ).toBeGreaterThanOrEqual(0);

    await venueName.fill(HOST_VENUE_NAME);
    await nextButton(page, locale).click();
    await selectSchedule(page);
    await nextButton(page, locale).click();
    await continueToLoginButton(page, locale).click();

    for (const field of ['host-title', 'host-description']) {
      await expect(page.locator(`#${field}-error`)).toBeVisible();
      const counter = await measureNote(page, locale, field, 'count');
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
