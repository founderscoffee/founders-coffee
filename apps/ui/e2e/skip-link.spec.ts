import { expect, test, type Page } from '@playwright/test';

const SKIP_TARGET = '#main-content';
const SKIP_LINK = `a[href="${SKIP_TARGET}"]`;

/**
 * How much of the skip link a sighted keyboard user can actually see, in square pixels of overlap
 * with the viewport.
 *
 * Asserting on class names is what let FC-16 ship: the link carried `sr-only focus:not-sr-only`,
 * the unit test read both back, and the link was still invisible on focus because an unlayered
 * vendor `.sr-only` outranked the layered utility meant to undo it. Only a real browser can settle
 * that, and only by measuring, so this asks the geometry rather than the markup — which also leaves
 * the mechanism free to change to something other than an offset.
 */
const onScreenArea = async (page: Page): Promise<number> => {
  const box = await page.locator(SKIP_LINK).boundingBox();
  const viewport = page.viewportSize();
  if (!box || !viewport) return 0;
  const width =
    Math.min(box.x + box.width, viewport.width) - Math.max(box.x, 0);
  const height =
    Math.min(box.y + box.height, viewport.height) - Math.max(box.y, 0);
  return Math.max(0, width) * Math.max(0, height);
};

test.describe('Skip link', () => {
  for (const path of ['/en', '/fr', '/']) {
    test(`comes into view when a keyboard reaches it (${path})`, async ({
      page,
    }) => {
      await page.goto(path);
      const link = page.locator(SKIP_LINK);
      await expect(link).toHaveCount(1);

      expect(
        await onScreenArea(page),
        'the skip link is sitting in the page before anyone asked for it',
      ).toBeLessThanOrEqual(4);

      await page.keyboard.press('Tab');
      await expect(link).toBeFocused();

      await expect(async () => {
        expect(
          await onScreenArea(page),
          'the focused skip link never becomes visible, so nobody can tell it is there',
        ).toBeGreaterThan(1000);
      }).toPass({ timeout: 2_000 });
    });
  }

  test('hands keyboard focus to the main landmark', async ({ page }) => {
    await page.goto('/en');
    await expect(page.locator(SKIP_LINK)).toHaveCount(1);

    await page.keyboard.press('Tab');
    await page.keyboard.press('Enter');
    await expect(page.locator(SKIP_TARGET)).toBeFocused();

    await page.keyboard.press('Tab');
    const landed = await page.evaluate((target) => {
      const main = document.querySelector(target);
      return main?.contains(document.activeElement) ?? false;
    }, SKIP_TARGET);

    expect(
      landed,
      'the Tab after the skip goes back into the header the skip was for',
    ).toBe(true);
  });
});
