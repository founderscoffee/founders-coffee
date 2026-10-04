import { expect, test, type Locator } from '@playwright/test';

import { cleanupRun } from './support/d1';
import { LOCALE_DIRECTION, t, type E2eLocale } from './support/messages';
import { signIn } from './support/profile-auth';
import { RUN_ID } from './support/run';

const LOCALES: readonly E2eLocale[] = ['ar', 'fr', 'en'];
const PHONE_WIDTHS = [360, 390, 402] as const;
const SIGNED_IN_LOCALES = ['ar', 'en'] as const;

type Box = { x: number; width: number };

/**
 * The box a control is drawn in, failing the test when it is not drawn at all.
 */
const boxOf = async (locator: Locator): Promise<Box> => {
  const box = await locator.boundingBox();
  if (!box) throw new Error('expected the control to be laid out');
  return box;
};

/** The member the signed-in header test signs in as in `locale`, named by the run. */
const memberEmail = (locale: E2eLocale): string =>
  `e2e-header-${locale}-${RUN_ID}@e2e.invalid`;

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

test.describe('Site header sign-in slot', () => {
  for (const locale of LOCALES) {
    for (const width of [390, 1280] as const) {
      test(`reserves the width of its own label, no more (${locale}, ${width}px)`, async ({
        page,
      }) => {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`/${locale}/algeria`);

        const nav = page.getByRole('navigation', { name: t(locale, 'brand') });
        const signIn = nav.getByRole('link', { name: t(locale, 'sign_in') });
        await expect(signIn).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute(
          'data-auth-slot',
          'out',
        );
        await page.evaluate(() => document.fonts.ready);

        const { reserved, label } = await signIn.evaluate(
          (link: HTMLElement) => {
            const slot = link.closest('.auth-slot');
            if (!slot) throw new Error('expected sign-in inside the slot');
            const text = document.createRange();
            text.selectNodeContents(link);
            const style = getComputedStyle(link);
            const edges = [
              style.paddingLeft,
              style.paddingRight,
              style.borderLeftWidth,
              style.borderRightWidth,
            ].reduce((sum, edge) => sum + parseFloat(edge), 0);
            return {
              reserved: parseFloat(getComputedStyle(slot).minWidth),
              label: text.getBoundingClientRect().width + edges,
            };
          },
        );

        expect(
          reserved,
          'the slot is held open before the session is known; held narrower than the button, the host button jumps when sign-in appears',
        ).toBeGreaterThanOrEqual(label);
        expect(
          reserved - label,
          'the button fills the slot, so a hold sized for a longer language stretches its outline past its own label',
        ).toBeLessThanOrEqual(6);
      });
    }
  }
});

test.describe('Site header when signed in', () => {
  test.afterAll(() =>
    cleanupRun({ eventIds: [], emails: SIGNED_IN_LOCALES.map(memberEmail) }),
  );

  for (const locale of SIGNED_IN_LOCALES) {
    test(`ends the row with the avatar, after the host button (${locale})`, async ({
      page,
    }) => {
      test.setTimeout(120_000);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(
        `/${locale}/login?redirect=${encodeURIComponent(`/${locale}/algeria`)}`,
      );
      await signIn(page, locale, memberEmail(locale), 'login_email_continue');
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
