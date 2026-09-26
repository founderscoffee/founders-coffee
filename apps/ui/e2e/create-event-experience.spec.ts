import { expect, test, type Locator, type Page } from '@playwright/test';

import { LOCALE_DIRECTION, t, type E2eLocale } from './support/messages';
import { localeFor } from './support/run';
import {
  VENUE_QUERY,
  backButton,
  continueToLoginButton,
  nextButton,
  selectSchedule,
  selectVenue,
  useLocale,
  wizardPath,
} from './support/host-wizard';

/**
 * Hold a step's actions to the thumb: on screen, tall enough to tap, and never pushing the page
 * sideways, which a primary label too long for one line did on the last step.
 */
const expectActionsInReach = async (
  page: Page,
  actions: readonly Locator[],
): Promise<void> => {
  for (const action of actions) {
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
};

/**
 * Walk to the schedule and on to the details step, holding both actions to reach on each.
 */
const walkWizardActions = async (
  page: Page,
  locale: E2eLocale,
): Promise<void> => {
  await page.goto(wizardPath());
  await selectVenue(page, locale, VENUE_QUERY);
  await nextButton(page, locale).click();
  await expectActionsInReach(page, [
    backButton(page, locale),
    nextButton(page, locale),
  ]);

  await selectSchedule(page);
  await nextButton(page, locale).click();
  await expectActionsInReach(page, [
    backButton(page, locale),
    continueToLoginButton(page, locale),
  ]);
};

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

    await selectVenue(page, locale, VENUE_QUERY);
    const savedVenue = await page.locator('#venue-search').inputValue();
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
    await expect(page.locator('#venue-search')).toHaveValue(savedVenue);
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

  test('keeps both wizard actions reachable at this viewport and at 320px', async ({
    page,
    baseURL,
  }, testInfo) => {
    const locale = localeFor(testInfo.project.name);
    await useLocale(page, locale, baseURL as string);
    await walkWizardActions(page, locale);

    await page.setViewportSize({ width: 320, height: 640 });
    await expectActionsInReach(page, [
      backButton(page, locale),
      continueToLoginButton(page, locale),
    ]);
  });

  test('floats the venue list over the map instead of pushing it down', async ({
    page,
    baseURL,
  }, testInfo) => {
    test.skip(
      (page.viewportSize()?.width ?? 0) >= 1024,
      'from lg up the list has a rail of its own beside the map',
    );
    const locale = localeFor(testInfo.project.name);
    await useLocale(page, locale, baseURL as string);
    await page.goto(wizardPath());

    const map = page.locator('.mapboxgl-canvas');
    await expect(map).toBeVisible({ timeout: 30_000 });
    const { height } = (await map.boundingBox()) ?? { height: 0 };
    await page
      .getByRole('combobox', {
        name: t(locale, 'host_venue_search_label'),
        exact: true,
      })
      .fill(VENUE_QUERY);
    const list = page.getByRole('listbox', {
      name: t(locale, 'host_search_results'),
      exact: true,
    });
    await expect(list.getByRole('option').first()).toBeVisible({
      timeout: 30_000,
    });

    const mapBox = await map.boundingBox();
    const listBox = await list.boundingBox();
    expect(mapBox?.height).toBe(height);
    expect(listBox?.y ?? 0).toBeGreaterThan(mapBox?.y ?? 0);
    const isOnTop = await list.evaluate((node) => {
      const box = node.getBoundingClientRect();
      const hit = document.elementFromPoint(
        box.left + box.width / 2,
        box.top + 20,
      );
      return node.contains(hit);
    });
    expect(isOnTop).toBe(true);
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

    await selectVenue(page, locale, VENUE_QUERY);
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
