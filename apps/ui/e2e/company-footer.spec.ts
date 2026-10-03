import { expect, test, type Locator } from '@playwright/test';

import { COMPANY_PAGES } from '../src/content/company/pages';
import { SOURCE_REPOSITORY_URL } from '../src/lib/source-repository';

import { t, type E2eLocale } from './support/messages';

const LOCALES: readonly E2eLocale[] = ['ar', 'fr', 'en'];

const companyPaths = [
  { path: '/about', heading: /about|من نحن|عن|à propos/i },
  { path: '/contact', heading: /contact|تواصل/i },
  { path: '/privacy', heading: /privacy|الخصوصية|confidentialité/i },
  { path: '/terms', heading: /terms|شروط|conditions/i },
  { path: '/cookies', heading: /cookie|ملفات تعريف الارتباط/i },
] as const;

/**
 * How many lines a link's label is laid out on, counted from its text's boxes.
 */
const linesOf = (link: Locator): Promise<number> =>
  link.evaluate((element) => {
    const range = document.createRange();
    range.selectNodeContents(element);
    return new Set(
      [...range.getClientRects()]
        .filter((rect) => rect.width)
        .map((rect) => Math.round(rect.top)),
    ).size;
  });

test.describe('Company footer links', () => {
  test('footer links navigate to real company pages', async ({ page }) => {
    await page.goto('/');
    const locale = await page.locator('html').getAttribute('lang');
    const footer = page.getByRole('contentinfo');
    await expect(footer).toBeVisible();

    for (const key of Object.keys(COMPANY_PAGES)) {
      const link = footer.locator(`a[href="/${locale}/${key}"]:visible`);
      await expect(link).toBeVisible();
    }
  });

  for (const { path, heading } of companyPaths) {
    test(`${path} returns 200 and renders content`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.ok()).toBeTruthy();
      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.locator('h1').first()).toHaveText(heading);
      await expect(page.getByRole('contentinfo')).toBeVisible();
    });
  }

  test('legal pages publish as final, with no draft disclaimer', async ({
    page,
  }) => {
    for (const path of ['/privacy', '/terms', '/cookies']) {
      await page.goto(path);
      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page.getByText(/draft|مسودة|brouillon/i)).toHaveCount(0);
    }
  });

  for (const locale of LOCALES) {
    test(`offers the source code on one line, on a phone and on a desktop (${locale})`, async ({
      page,
    }) => {
      for (const width of [320, 360, 1280] as const) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(`/${locale}/about`);

        const footer = page.getByRole('contentinfo');
        if (width < 768)
          await footer
            .locator('summary', { hasText: t(locale, 'footer_company') })
            .click();

        const link = footer.locator(
          `a[href="${SOURCE_REPOSITORY_URL}"]:visible`,
        );
        await expect(link).toHaveText(t(locale, 'footer_source'));
        expect(
          await linesOf(link),
          `the ${locale} label wraps at ${width}px: shorten it in that language`,
        ).toBe(1);
      }
    });
  }

  test('footer adapts navigation for mobile, tablet, and desktop', async ({
    page,
  }) => {
    const viewports = [
      { width: 390, height: 844, isCompact: true },
      { width: 768, height: 1024, isCompact: false },
      { width: 1280, height: 800, isCompact: false },
    ] as const;

    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto('/');

      const footer = page.getByRole('contentinfo');
      await expect(footer).toBeVisible();
      await expect(footer.locator('a').first()).toBeVisible();

      const mobileGroup = footer.locator('details').first();
      if (viewport.isCompact) {
        await expect(mobileGroup).toBeVisible();
        await mobileGroup.locator('summary').click();
        await expect(mobileGroup.locator('a').first()).toBeVisible();
      } else {
        await expect(mobileGroup).toBeHidden();
      }
    }
  });
});
