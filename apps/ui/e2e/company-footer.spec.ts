import { expect, test } from '@playwright/test';

const companyPaths = [
  { path: '/about', heading: /about|من نحن|عن|à propos/i },
  { path: '/contact', heading: /contact|تواصل/i },
  { path: '/privacy', heading: /privacy|الخصوصية|confidentialité/i },
  { path: '/terms', heading: /terms|الشروط|conditions/i },
  { path: '/cookies', heading: /cookie|ملفات تعريف الارتباط/i },
] as const;

test.describe('Company footer links', () => {
  test('footer links navigate to real company pages', async ({ page }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');
    await expect(footer).toBeVisible();

    for (const { path } of companyPaths) {
      const link = footer.locator(`a[href="${path}"]:visible`);
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute('href', path);
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

  test('privacy shows legal draft notice', async ({ page }) => {
    await page.goto('/privacy');
    await expect(page.getByRole('note')).toContainText(
      /draft|مسودة|brouillon/i,
    );
  });

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
