import { expect, test } from '@playwright/test';

test.describe('Response privacy directives', () => {
  test('private pages refuse every cache and every index', async ({ page }) => {
    for (const path of ['/profile', '/u/usr_nobody']) {
      const response = await page.goto(path);
      const headers = response?.headers() ?? {};
      expect(headers['cache-control']).toBe('private, no-store');
      expect(headers['x-robots-tag']).toBe('noindex, nofollow');
    }
  });

  test('a public landing page stays cacheable and indexable', async ({
    page,
  }) => {
    const headers = (await page.goto('/algeria'))?.headers() ?? {};

    expect(headers['x-robots-tag']).toBeUndefined();
    expect(headers['cache-control'] ?? '').not.toContain('no-store');
  });

  test('an event page refuses a shared copy and stays indexable', async ({
    page,
    request,
  }) => {
    await page.goto('/algeria');
    const href = await page
      .locator('a[href*="/e/"]')
      .first()
      .getAttribute('href');
    test.skip(!href, 'no published event in this environment');

    const headers = (await request.get(href as string)).headers();
    expect(headers['cache-control']).toBe('private, no-store');
    expect(headers['x-robots-tag']).toBeUndefined();
  });
});
