import { expect, test } from '@playwright/test';

import { LOCALE_DIRECTION, t, type E2eLocale } from './support/messages';
import { localeFor } from './support/run';
import {
  backButton,
  nextButton,
  selectVenue,
  useLocale,
  wizardPath,
} from './support/host-wizard';

test.describe('create event experience', () => {
  test('keeps the draft and the active step across a locale change', async ({
    page,
    baseURL,
  }, testInfo) => {
    test.setTimeout(120_000);
    const locale = localeFor(testInfo.project.name);
    const other: E2eLocale = locale === 'en' ? 'fr' : 'en';
    await useLocale(page, locale, baseURL as string);
    await page.goto(wizardPath());

    const venueName = await selectVenue(page, 'cafe');
    await nextButton(page, locale).click();
    await expect(page.locator('.rdp-button_next')).toBeVisible();

    await page
      .context()
      .addCookies([
        { name: 'PARAGLIDE_LOCALE', value: other, url: baseURL as string },
      ]);
    await page.reload();

    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      LOCALE_DIRECTION[other],
    );
    await expect(page.locator('.rdp-button_next')).toBeVisible({
      timeout: 30_000,
    });
    await backButton(page, other).click();
    await expect(page.locator('#venue-search')).toHaveValue(
      new RegExp(venueName.slice(0, 8).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    );
  });

  test('shows localized inline validation and focuses the first invalid field', async ({
    page,
    baseURL,
  }, testInfo) => {
    const locale = localeFor(testInfo.project.name);
    await useLocale(page, locale, baseURL as string);
    await page.goto(wizardPath());

    await expect(page.locator('#venue-search')).toBeEnabled({
      timeout: 30_000,
    });
    await nextButton(page, locale).click();

    await expect(
      page.getByText(t(locale, 'host_venue_required')),
    ).toBeVisible();
    await expect(page.locator('#venue-search')).toBeFocused();
  });

  test('keeps both wizard actions reachable at this viewport', async ({
    page,
    baseURL,
  }, testInfo) => {
    const locale = localeFor(testInfo.project.name);
    await useLocale(page, locale, baseURL as string);
    await page.goto(wizardPath());

    await selectVenue(page, 'cafe');
    await nextButton(page, locale).click();

    for (const action of [backButton(page, locale), nextButton(page, locale)]) {
      await expect(action).toBeVisible();
      await expect(action).toBeInViewport();
      const box = await action.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
    }

    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(1);
  });

  test('announces semantic step progress', async ({
    page,
    baseURL,
  }, testInfo) => {
    const locale = localeFor(testInfo.project.name);
    await useLocale(page, locale, baseURL as string);
    await page.goto(wizardPath());

    const progress = page.getByRole('navigation', {
      name: t(locale, 'host_progress_label'),
    });
    const currentStep = progress.locator('li[aria-current="step"]');
    await expect(currentStep).toHaveCount(1);
    await expect(currentStep).toHaveText(t(locale, 'host_step1'));
    await expect(progress.getByRole('status')).toContainText(
      t(locale, 'host_step1'),
    );

    await selectVenue(page, 'cafe');
    await nextButton(page, locale).click();

    await expect(currentStep).toHaveText(t(locale, 'host_step2'));
    await expect(progress.getByRole('status')).toContainText(
      t(locale, 'host_step2'),
    );
  });

  test('never requests precise location without an explicit action', async ({
    page,
    baseURL,
  }, testInfo) => {
    const locale = localeFor(testInfo.project.name);
    await useLocale(page, locale, baseURL as string);
    await page.addInitScript(() => {
      const w = window as unknown as { __geo?: number };
      w.__geo = 0;
      const original = navigator.geolocation?.getCurrentPosition;
      if (!original) return;
      navigator.geolocation.getCurrentPosition = ((...args: unknown[]) => {
        w.__geo = (w.__geo ?? 0) + 1;
        return (original as (...a: unknown[]) => void).apply(
          navigator.geolocation,
          args,
        );
      }) as typeof navigator.geolocation.getCurrentPosition;
    });
    await page.goto(wizardPath());
    await expect(page.locator('#venue-search')).toBeEnabled({
      timeout: 30_000,
    });

    const calls = await page.evaluate(
      () => (window as unknown as { __geo?: number }).__geo ?? 0,
    );
    expect(calls).toBe(0);
  });
});
