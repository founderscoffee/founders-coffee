import { expect, test, type Locator } from '@playwright/test';

import { LOCALE_DIRECTION, t, type E2eLocale } from './support/messages';
import { completeProfileName, signIn } from './support/profile-auth';
import { RUN_ID } from './support/run';

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
 * How far `after` reaches back into `before` along the reading direction, in pixels; zero or less
 * means `after` stands clear of `before`, further along the row.
 */
const reachBack = (before: Box, after: Box, isRtl: boolean): number =>
  isRtl ? after.x + after.width - before.x : before.x + before.width - after.x;

test.describe('Site header on a phone', () => {
  for (const locale of LOCALES) {
    for (const width of PHONE_WIDTHS) {
      test(`keeps the logo whole, then sign-in, then the host button (${locale}, ${width}px)`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`/${locale}/algeria`);

        const isRtl = LOCALE_DIRECTION[locale] === 'rtl';
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

        const signInBox = await boxOf(signIn);
        const hostBox = await boxOf(host);
        expect(
          reachBack(await boxOf(logo), signInBox, isRtl),
        ).toBeLessThanOrEqual(0);
        expect(
          reachBack(signInBox, hostBox, isRtl),
          'the outlined sign-in comes first and the filled host button ends the row',
        ).toBeLessThanOrEqual(0);
        expect(hostBox.x).toBeGreaterThanOrEqual(0);
        expect(hostBox.x + hostBox.width).toBeLessThanOrEqual(width);

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

test.describe('Site header when signed in', () => {
  for (const locale of ['ar', 'en'] as const) {
    test(`ends the row with the avatar, after the host button (${locale})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(
        `/${locale}/login?redirect=${encodeURIComponent(`/${locale}/algeria`)}`,
      );
      await signIn(
        page,
        locale,
        `e2e-header-${locale}-${RUN_ID}@e2e.invalid`,
        'login_email_continue',
      );
      await completeProfileName(page, locale, 'E2E Header');
      await page.waitForURL(new RegExp(`/${locale}/algeria$`, 'u'), {
        timeout: 60_000,
      });

      const nav = page.getByRole('navigation', { name: t(locale, 'brand') });
      const host = nav.getByRole('link', { name: t(locale, 'nav_host') });
      const avatar = nav.getByLabel(t(locale, 'profile_title'));
      await expect(avatar).toBeVisible();

      expect(
        reachBack(
          await boxOf(host),
          await boxOf(avatar),
          LOCALE_DIRECTION[locale] === 'rtl',
        ),
        'an account menu is looked for at the end of the row',
      ).toBeLessThanOrEqual(0);
    });
  }
});
