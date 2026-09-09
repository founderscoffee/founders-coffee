import { expect, test } from '@playwright/test';

import {
  cleanupRun,
  findEventByTitle,
  type PersistedEvent,
} from './support/d1';
import { signIn, completeProfileName } from './support/profile-auth';
import { LOCALE_DIRECTION } from './support/messages';
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
  useLocale,
  wizardPath,
} from './support/host-wizard';

const createdEventIds: string[] = [];
const createdEmails: string[] = [];

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
    await signIn(page, locale, email);

    await expect(page).toHaveURL(/host\/create/);
    await completeProfileName(page, locale, `Founder ${locale}`);

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
