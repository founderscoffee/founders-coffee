import { expect, test, type Page } from '@playwright/test';

import {
  cleanupRun,
  findEventByTitle,
  type PersistedEvent,
} from './support/d1';
import { latestSignInOtp } from './support/otp';
import { LOCALE_DIRECTION, t, type E2eLocale } from './support/messages';
import {
  disposableEmail,
  localeFor,
  RUN_ID,
  uniqueTitle,
  watchForApplicationErrors,
} from './support/run';
import {
  CITY_SLUG,
  MARKET_SLUG,
  VENUE_QUERY,
  completeWizardToConfirmation,
  continueToLoginButton,
  publishButton,
  useLocale,
  wizardPath,
} from './support/host-wizard';

const createdEventIds: string[] = [];
const createdEmails: string[] = [];

/**
 * Sign in the disposable host through the real one-time-code flow.
 *
 * The code is read from the database rather than an inbox: the flow under test is the
 * application's, not the email provider's, and EC-10 has to run this same path against a deployed
 * environment where no mailbox is reachable.
 */
const signIn = async (
  page: Page,
  locale: E2eLocale,
  email: string,
): Promise<void> => {
  await page.locator('input[type="email"]').fill(email);
  await page
    .getByRole('button', { name: t(locale, 'login_send_code'), exact: true })
    .click();

  const otpField = page.locator('input[autocomplete="one-time-code"]');
  await expect(otpField).toBeVisible({ timeout: 30_000 });

  await expect
    .poll(() => latestSignInOtp(email), { timeout: 30_000, intervals: [500] })
    .not.toBeNull();
  await otpField.fill(latestSignInOtp(email) as string);
  await page
    .getByRole('button', { name: t(locale, 'login_verify'), exact: true })
    .click();
};

/**
 * Finish onboarding when a brand-new account is sent through it before returning to the wizard.
 *
 * The state choice is retried until it sticks, because the markup is interactive before React has
 * hydrated and a selection made in that window is silently dropped — a real host is slower than a
 * test runner. The city list arrives only once the chosen state is in the URL, which is what the
 * route loads it from.
 */
const completeOnboardingIfShown = async (
  page: Page,
  locale: E2eLocale,
): Promise<void> => {
  if (!page.url().includes('/onboarding')) return;
  const selects = page.locator('select');
  await expect(selects.first()).toBeVisible({ timeout: 15_000 });
  await expect(async () => {
    await selects.nth(1).selectOption({ index: 1 });
    await page.waitForURL(/state=/, { timeout: 2_000 });
  }).toPass({ timeout: 30_000 });

  const cityField = page.getByRole('combobox').last();
  await cityField.click();
  const firstCity = page
    .locator('#city-search-listbox [role="option"]')
    .first();
  await expect(firstCity).toBeVisible({ timeout: 30_000 });
  await firstCity.click();

  const save = page.getByRole('button', {
    name: t(locale, 'onboarding_save'),
    exact: true,
  });
  await expect(save).toBeEnabled({ timeout: 15_000 });
  await save.click();
};

test.describe('create event', () => {
  test.describe.configure({ mode: 'serial' });

  test.afterAll(() => {
    if (createdEventIds.length === 0 && createdEmails.length === 0) return;
    cleanupRun({ eventIds: createdEventIds, emails: createdEmails });
  });

  test('anonymous host completes the wizard, authenticates, and publishes', async ({
    page,
    baseURL,
  }, testInfo) => {
    test.setTimeout(180_000);
    const locale = localeFor(testInfo.project.name);
    const title = uniqueTitle(locale);
    const email = disposableEmail(locale);
    createdEmails.push(email);

    await useLocale(page, locale, baseURL as string);
    const failures = watchForApplicationErrors(page);
    await page.goto(wizardPath());

    await expect(page.locator('html')).toHaveAttribute(
      'dir',
      LOCALE_DIRECTION[locale],
    );

    const details = {
      title,
      description: `A complete end-to-end event created by the ${locale} regression run ${RUN_ID}.`,
    } as const;
    const venueName = await completeWizardToConfirmation(
      page,
      locale,
      details,
      VENUE_QUERY,
    );

    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText(details.description)).toBeVisible();
    await expect(page.getByText(venueName).first()).toBeVisible();

    await continueToLoginButton(page, locale).click();
    await page.waitForURL(/\/login/, { timeout: 30_000 });
    await signIn(page, locale, email);

    await page.waitForURL(/\/(onboarding|algeria)/, { timeout: 60_000 });
    await completeOnboardingIfShown(page, locale);
    await page.waitForURL(/host\/create/, { timeout: 60_000 });

    await expect(page.getByText(title)).toBeVisible({ timeout: 30_000 });
    const publish = publishButton(page, locale);
    await expect(publish).toBeEnabled({ timeout: 30_000 });
    await publish.click();

    await page.waitForURL(new RegExp(`/${MARKET_SLUG}/e/`), {
      timeout: 60_000,
    });
    await expect(
      page.getByRole('heading', { name: title, exact: true }),
    ).toBeVisible({ timeout: 30_000 });

    await expect
      .poll(() => findEventByTitle(title), { timeout: 30_000 })
      .not.toBeUndefined();
    const persisted = findEventByTitle(title) as PersistedEvent;
    createdEventIds.push(persisted.id);

    expect(persisted).toMatchObject({
      market_code: 'DZ',
      city_code: '556',
      language: locale,
      status: 'published',
      is_free: 1,
      description: details.description,
    });
    expect(persisted.venue).toBe(venueName);
    expect(persisted.venue_address).toBeTruthy();
    expect(persisted.latitude).not.toBeNull();
    expect(persisted.longitude).not.toBeNull();
    expect(persisted.ends_at).toBeGreaterThan(persisted.starts_at);
    expect(persisted.starts_at * 1000).toBeGreaterThan(Date.now());
    expect(page.url()).toContain(`/${MARKET_SLUG}/e/${persisted.slug}`);

    await page.goto(`/${MARKET_SLUG}/${CITY_SLUG}`);
    await expect(page.getByText(title).first()).toBeVisible({
      timeout: 30_000,
    });

    await page.goto(`/u/${persisted.host_id}`);
    await expect(page.getByText(title).first()).toBeVisible({
      timeout: 30_000,
    });

    expect(
      failures,
      `unexpected application errors:\n${failures.join('\n')}`,
    ).toHaveLength(0);
  });
});
