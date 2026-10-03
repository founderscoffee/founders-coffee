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
 * Choose a venue through the real search box, which a host opens from Search on the map.
 *
 * `VENUE_QUERY` is a street rather than a category word on purpose: Mapbox indexes no points of
 * interest across the Maghreb, so searching "café" matches nothing there and a host searches the
 * street instead, naming the place themselves. A category query would pass only in a market with
 * POI coverage, making this gate green everywhere except the market it exists to protect.
 *
 * The box is closed on arrival and opens from the Search button, which the map shows once the
 * server has returned the city viewport, so the wait is on that button rather than on a fixed
 * delay: a timing assumption here would make the whole suite flaky on a cold Worker. The box opens
 * over the places nearby, so the first option on the page is not a match; the pick waits for the
 * list to be named as search results, which is the list a host who typed the street is reading.
 * Picking puts the box away and the list with it below `lg`, so the choice is read from the one
 * option left selected, hidden or not. Where only an address could be verified the wizard asks
 * for a name beside the place chosen, and this fills it, mirroring what a host does.
 */
export const selectVenue = async (
  page: Page,
  locale: E2eLocale,
  query: string,
): Promise<string> => {
  const search = page.getByRole('combobox', {
    name: t(locale, 'host_venue_search_label'),
    exact: true,
  });
  const openSearch = page.getByRole('button', {
    name: t(locale, 'host_search_venues'),
    exact: true,
  });
  await expect(search.or(openSearch)).toBeVisible({ timeout: 30_000 });
  if (!(await search.isVisible())) await openSearch.click();
  await expect(search).toBeFocused();
  await search.fill(query);
  const listName = t(locale, 'host_search_results');
  const firstResult = page
    .getByRole('listbox', { name: listName, exact: true, includeHidden: true })
    .getByRole('option', { includeHidden: true })
    .first();
  await expect(firstResult).toBeVisible({ timeout: 30_000 });
  const providerName = (await firstResult.innerText()).split('\n')[0].trim();
  await firstResult.click();
  await expect(search).toHaveCount(0);
  await expect(
    page.getByRole('option', { selected: true, includeHidden: true }),
  ).toContainText(providerName);

  const nameField = page.locator('#host-venue-name');
  if ((await nameField.count()) === 0) return providerName;
  await nameField.fill(HOST_VENUE_NAME);
  return HOST_VENUE_NAME;
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

/**
 * Walk venue → schedule → details, leaving the wizard on its final step.
 *
 * The details step is the last of three, so the confirmation lives on it: its primary action reads
 * `host_continue_login` to an anonymous host and `host_confirm_publish` once signed in, and there
 * is no `host_next` after the details are filled.
 */
export const completeWizardToConfirmation = async (
  page: Page,
  locale: E2eLocale,
  details: EventDetails,
  venueQuery: string,
): Promise<string> => {
  const venueName = await selectVenue(page, locale, venueQuery);
  await nextButton(page, locale).click();
  await selectSchedule(page);
  await nextButton(page, locale).click();
  await fillDetails(page, details);
  return venueName;
};
