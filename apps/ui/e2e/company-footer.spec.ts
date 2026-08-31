import { expect, test } from '@playwright/test';

const companyPaths = [
  { path: '/about', heading: /founders\.coffee|عن|à propos/i },
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
      const link = footer.locator(`a[href="${path}"]`);
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
});
