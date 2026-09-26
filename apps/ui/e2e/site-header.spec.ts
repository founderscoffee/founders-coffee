import { expect, test, type Locator } from '@playwright/test';

import { LOCALE_DIRECTION, t, type E2eLocale } from './support/messages';

const LOCALES: readonly E2eLocale[] = ['ar', 'fr', 'en'];
const PHONE_WIDTHS = [360, 390, 402] as const;

type Box = { x: number; width: number };

/**
 * The box a control is drawn in, failing the test when it is not drawn at all.
 */
const boxOf = async (locator: Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  if (!box) throw new Error('expected the control to be laid out');
  return box;
};

/**
 * How far the host button reaches into the logo, in pixels, along the reading direction; zero or
 * less means the two stand apart.
 */
const reachIntoLogo = (logo: Box, host: Box, isRtl: boolean): number =>
  isRtl ? host.x + host.width - logo.x : logo.x + logo.width - host.x;

test.describe('Site header on a phone', () => {
  for (const locale of LOCALES) {
    for (const width of PHONE_WIDTHS) {
      test(`keeps the logo whole beside the host button (${locale}, ${width}px)`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`/${locale}/algeria`);

        const nav = page.getByRole('navigation', { name: t(locale, 'brand') });
        const logo = nav.getByRole('link', { name: t(locale, 'brand') });
        const host = nav.getByRole('link', { name: t(locale, 'nav_host') });
        const signIn = nav.getByRole('link', { name: t(locale, 'sign_in') });
        await expect(signIn).toBeVisible();

        const drawn = await logo
          .locator('img:visible')
          .evaluate((image: HTMLImageElement) => ({
            width: image.getBoundingClientRect().width,
            intended: Number(image.getAttribute('width')),
          }));
        expect(
          drawn.width,
          'the row squeezed the logo to make room for the host button (#117)',
        ).toBe(drawn.intended);

        expect(
          reachIntoLogo(
            await boxOf(logo),
            await boxOf(host),
            LOCALE_DIRECTION[locale] === 'rtl',
          ),
        ).toBeLessThanOrEqual(0);

        const signInBox = await boxOf(signIn);
        expect(signInBox.x).toBeGreaterThanOrEqual(0);
        expect(signInBox.x + signInBox.width).toBeLessThanOrEqual(width);

        const pageWidth = await page.evaluate(
          () => document.documentElement.scrollWidth,
        );
        expect(pageWidth, 'the header made the page scroll sideways').toBe(
          width,
        );
      });
    }
  }
});
