import { expect, type Page } from '@playwright/test';

import { t, type E2eLocale } from './messages';

export const MARKET_SLUG = 'algeria';
export const CITY_CODE = '556';
export const CITY_SLUG = 'algiers';

export const wizardPath = (): string =>
  `/${MARKET_SLUG}/host/create?city=${CITY_CODE}`;

/**
 * Put the browser in `locale` before the first navigation.
 *
 * The application resolves its locale from the Paraglide cookie, so setting it up front is what
 * makes one spec prove all three builds instead of three copies of the same spec.
 */
export const useLocale = async (
  page: Page,
  locale: E2eLocale,
  baseURL: string,
): Promise<void> => {
  await page
    .context()
    .addCookies([{ name: 'PARAGLIDE_LOCALE', value: locale, url: baseURL }]);
};

export const nextButton = (page: Page, locale: E2eLocale) =>
  page.getByRole('button', { name: t(locale, 'host_next'), exact: true });

export const backButton = (page: Page, locale: E2eLocale) =>
  page.getByRole('button', { name: t(locale, 'host_back'), exact: true });

export const publishButton = (page: Page, locale: E2eLocale) =>
  page.getByRole('button', {
    name: t(locale, 'host_confirm_publish'),
    exact: true,
  });

export const continueToLoginButton = (page: Page, locale: E2eLocale) =>
  page.getByRole('button', {
    name: t(locale, 'host_continue_login'),
    exact: true,
  });

/**
 * Choose a venue through the real search box, which is the path a host actually uses.
 *
 * The field stays disabled until the server has returned the city viewport, so the wait is on the
 * control being enabled rather than on a fixed delay — a timing assumption here would make the
 * whole suite flaky on a cold Worker.
 */
export const selectVenue = async (
  page: Page,
  query: string,
): Promise<string> => {
  const search = page.locator('#venue-search');
  await expect(search).toBeEnabled({ timeout: 30_000 });
  await search.fill(query);
  const firstResult = page.locator('#venue-search-option-0');
  await expect(firstResult).toBeVisible({ timeout: 30_000 });
  const venueName = (await firstResult.innerText()).split('\n')[0].trim();
  await firstResult.click();
  return venueName;
};

/** Pick a day next month, which is always in the future and always exists. */
export const selectSchedule = async (page: Page): Promise<void> => {
  await page.locator('.rdp-button_next').click();
  await page
    .locator('.rdp-day:not(.rdp-outside):not(.rdp-disabled) .rdp-day_button', {
      hasText: /^15$/,
    })
    .first()
    .click();
};

export interface EventDetails {
  readonly title: string;
  readonly description: string;
  readonly capacity: number;
  readonly language: E2eLocale;
  readonly category: string;
}

export const fillDetails = async (
  page: Page,
  details: EventDetails,
): Promise<void> => {
  await page.locator('#host-title').fill(details.title);
  await page.locator('#host-description').fill(details.description);
  await page.getByRole('checkbox').first().check();
  await page.locator('#host-capacity').fill(String(details.capacity));
  await page.locator('#host-language').selectOption(details.language);
  await page.locator('#host-category').selectOption(details.category);
};

/** Walk venue → schedule → details → confirmation, leaving the wizard on its final step. */
export const completeWizardToConfirmation = async (
  page: Page,
  locale: E2eLocale,
  details: EventDetails,
  venueQuery: string,
): Promise<string> => {
  const venueName = await selectVenue(page, venueQuery);
  await nextButton(page, locale).click();
  await selectSchedule(page);
  await nextButton(page, locale).click();
  await fillDetails(page, details);
  await nextButton(page, locale).click();
  return venueName;
};
