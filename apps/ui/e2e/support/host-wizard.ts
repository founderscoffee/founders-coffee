import { expect, type Page } from '@playwright/test';

import { t, type E2eLocale } from './messages';

export const MARKET_SLUG = 'algeria';

export const VENUE_QUERY = 'Didouche Mourad';
export const CITY_CODE = '556';
export const CITY_SLUG = 'algiers';

/**
 * The host wizard, as a member reaches it.
 *
 * Unprefixed by default, which is the address an old link or a saved bookmark still carries and
 * which answers 307 to the prefixed form; pass a locale to land on the prefixed form directly.
 */
export const wizardPath = (locale?: E2eLocale): string =>
  `${locale ? `/${locale}` : ''}/${MARKET_SLUG}/host/create?city=${CITY_CODE}`;

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

export const HOST_VENUE_NAME = 'Café des Fondateurs';

/**
 * Choose a venue through the real search box, which is the path a host actually uses.
 *
 * `VENUE_QUERY` is a street rather than a category word on purpose: Mapbox indexes no points of
 * interest across the Maghreb, so searching "café" matches nothing there and a host searches the
 * street instead, naming the place themselves. A category query would pass only in a market with
 * POI coverage, making this gate green everywhere except the market it exists to protect.
 *
 * The field stays disabled until the server has returned the city viewport, so the wait is on the
 * control being enabled rather than on a fixed delay — a timing assumption here would make the
 * whole suite flaky on a cold Worker. Where only an address could be verified the wizard asks for
 * a name, and this fills it, mirroring what a host does.
 */
export const selectVenue = async (
  page: Page,
  query: string,
): Promise<string> => {
  const search = page.locator('#venue-search');
  await expect(search).toBeEnabled({ timeout: 30_000 });
  await search.fill(query);
  const firstResult = page.locator('[role="radio"]').first();
  await expect(firstResult).toBeVisible({ timeout: 30_000 });
  const providerName = (await firstResult.innerText()).split('\n')[0].trim();
  await firstResult.click();

  const nameField = page.locator('#host-venue-name');
  if (await nameField.isVisible()) {
    await nameField.fill(HOST_VENUE_NAME);
    return HOST_VENUE_NAME;
  }
  return providerName;
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
}

export const fillDetails = async (
  page: Page,
  details: EventDetails,
): Promise<void> => {
  await page.locator('#host-title').fill(details.title);
  await page.locator('#host-description').fill(details.description);
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
