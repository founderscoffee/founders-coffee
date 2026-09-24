import { expect, test, type APIRequestContext } from '@playwright/test';

const NO_INDEX = 'noindex, nofollow';

/**
 * Whether the environment under test invites crawlers, asked of the environment itself.
 *
 * `X-Robots-Tag` on a document is not a fixed value: the Worker stamps `noindex` on every HTML
 * response unless `APP_ENVIRONMENT` is `production`, so a test that expects the header to be absent
 * only passes against production and fails everywhere the suite actually runs — dev, the preview,
 * staging. Setting that variable to `production` locally is not the way out either, because the
 * sign-in code echo is fenced behind `APP_ENVIRONMENT !== 'production'` and every spec that
 * authenticates depends on it.
 *
 * So the expectation is derived rather than assumed. `/robots.txt` already publishes the answer,
 * and asserting that the documents agree with it is the stronger claim anyway: the failure worth
 * catching is the two disagreeing — a staging deployment inviting crawlers into unpublished
 * events, or production quietly serving `noindex` to all of them.
 */
const invitesCrawlers = async (
  request: APIRequestContext,
): Promise<boolean> => {
  const body = await (await request.get('/robots.txt')).text();
  return body.includes('Allow: /');
};

test.describe('Response privacy directives', () => {
  test('private pages refuse every cache and every index', async ({
    request,
  }) => {
    for (const path of [
      '/en/profile',
      '/fr/feedback/evt_nobody',
      '/ar/login',
      '/en/u/usr_nobody',
    ]) {
      const response = await request.get(path, { maxRedirects: 0 });
      const headers = response.headers();
      expect(headers['cache-control'], path).toBe('private, no-store');
      expect(headers['x-robots-tag'], path).toBe(NO_INDEX);
    }
  });

  test('a private page turns an anonymous visitor away before it renders', async ({
    request,
  }) => {
    for (const path of [
      '/en/profile',
      '/fr/profile/activity',
      '/ar/profile/account',
      '/en/profile/notifications',
      '/en/closeout/evt_nobody',
      '/en/feedback/evt_nobody',
    ]) {
      const locale = path.split('/')[1];
      const response = await request.get(path, { maxRedirects: 0 });
      expect(response.status(), path).toBe(307);
      expect(response.headers()['location']).toBe(
        `/${locale}/login?redirect=${encodeURIComponent(path)}`,
      );
    }
  });

  test('a public landing page stays cacheable, and indexable where crawlers are invited', async ({
    page,
    request,
  }) => {
    const indexable = await invitesCrawlers(request);
    const headers = (await page.goto('/algeria'))?.headers() ?? {};

    expect(headers['cache-control'] ?? '').not.toContain('no-store');
    expect(headers['x-robots-tag']).toBe(indexable ? undefined : NO_INDEX);
  });

  test('an event page refuses a shared copy, and agrees with robots.txt', async ({
    page,
    request,
  }) => {
    const indexable = await invitesCrawlers(request);
    await page.goto('/algeria');
    const href = await page
      .locator('a[href*="/e/"]')
      .first()
      .getAttribute('href');
    test.skip(!href, 'no published event in this environment');

    const headers = (await request.get(href as string)).headers();
    expect(headers['cache-control']).toBe('private, no-store');
    expect(headers['x-robots-tag']).toBe(indexable ? undefined : NO_INDEX);
  });
});
