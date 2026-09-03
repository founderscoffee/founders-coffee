import { expect, test, type Page } from '@playwright/test';

import {
  cleanupRun,
  findEventByTitle,
  latestSignInOtp,
  type PersistedEvent,
} from './support/d1';
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

/** Finish onboarding when a brand-new account is sent through it before returning to the wizard. */
const completeOnboardingIfShown = async (page: Page): Promise<void> => {
  if (!page.url().includes('/onboarding')) return;
  const selects = page.locator('select');
  await expect(selects.first()).toBeVisible({ timeout: 15_000 });
  await selects.nth(1).selectOption({ index: 1 });
  const city = selects.nth(2);
  await expect(city.locator('option')).not.toHaveCount(1, { timeout: 15_000 });
  await city.selectOption({ index: 1 });
  await page.getByRole('button').last().click();
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
      capacity: 24,
      language: locale,
      category: 'workshop',
    } as const;
    const venueName = await completeWizardToConfirmation(
      page,
      locale,
      details,
      'cafe',
    );

    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText(details.description)).toBeVisible();
    await expect(page.getByText(venueName).first()).toBeVisible();

    await continueToLoginButton(page, locale).click();
    await page.waitForURL(/\/login/, { timeout: 30_000 });
    await signIn(page, locale, email);

    await page.waitForURL(/\/(onboarding|algeria)/, { timeout: 60_000 });
    await completeOnboardingIfShown(page);
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
      capacity: details.capacity,
      language: details.language,
      category: details.category,
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
