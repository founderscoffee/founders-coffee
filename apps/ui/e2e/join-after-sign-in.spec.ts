import { expect, test, type Page } from '@playwright/test';

import { cleanupRun, d1 } from './support/d1';
import { t, type E2eLocale } from './support/messages';
import { signIn } from './support/profile-auth';
import { newId, RUN_ID } from './support/run';

const LOCALES: readonly E2eLocale[] = ['ar', 'fr', 'en'];
const DAY_SECONDS = 86_400;

/** The rows one locale's run writes, named by its locale and the run so parallel runs never meet. */
const meetupFor = (locale: E2eLocale) => ({
  eventId: newId('evt'),
  hostId: `usr_e2e_join_after_sign_in_${locale}_${RUN_ID}`,
  hostEmail: `e2e-join-after-sign-in-host-${locale}-${RUN_ID}@e2e.invalid`,
  memberEmail: `e2e-join-after-sign-in-member-${locale}-${RUN_ID}@e2e.invalid`,
  slug: `e2e-join-after-sign-in-${locale}-${RUN_ID}`,
});

type Meetup = ReturnType<typeof meetupFor>;

/** A meetup in Algiers two days away, with nobody going yet. */
const seed = (meetup: Meetup): void => {
  const startsAt = Math.floor(Date.now() / 1000) + 2 * DAY_SECONDS;
  d1(
    `INSERT INTO user (id, name, email) VALUES ('${meetup.hostId}', 'Host ${RUN_ID}', '${meetup.hostEmail}'); ` +
      `INSERT INTO events (id, host_id, market_code, state_code, city_code, title, description, venue, starts_at, ends_at, language, languages, slug) ` +
      `VALUES ('${meetup.eventId}', '${meetup.hostId}', 'DZ', '16', '556', 'E2E join after sign-in ${RUN_ID}', 'Seeded for joining before signing in.', 'Café E2E', ${startsAt}, ${startsAt + 7_200}, 'ar', json_array('ar'), '${meetup.slug}');`,
  );
};

/** Remove what {@link seed} wrote and the member who signed in to it. */
const cleanup = (meetup: Meetup): void =>
  cleanupRun({
    eventIds: [meetup.eventId],
    emails: [meetup.hostEmail, meetup.memberEmail],
  });

/** The meetup's page in `locale`. */
const pathOf = (meetup: Meetup, locale: E2eLocale): string =>
  `/${locale}/algeria/e/${meetup.slug}`;

/**
 * Press Join while signed out and wait for the sign-in page it sends the reader to.
 *
 * The button is server-rendered, and a press that lands before React hydrates it does nothing, so
 * it is pressed again until the page changes.
 */
const pressJoinSignedOut = async (
  page: Page,
  locale: E2eLocale,
): Promise<void> => {
  const join = page.getByRole('button', { name: t(locale, 'rsvp_cta') });
  await expect(async () => {
    if (await join.isVisible()) await join.click({ timeout: 2_000 });
    await expect(page).toHaveURL(/\/login\?redirect=/, { timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
};

/** How many seats the meetup's member holds at it, read from D1. */
const seatsOf = (meetup: Meetup): number =>
  d1<{ seats: number }>(
    `SELECT count(*) AS seats FROM event_rsvps WHERE event_id = '${meetup.eventId}' AND user_id = (SELECT id FROM user WHERE email = '${meetup.memberEmail}')`,
  )[0]?.seats ?? 0;

for (const locale of LOCALES) {
  test.describe(`Join pressed before signing in (${locale})`, () => {
    const meetup = meetupFor(locale);
    const path = pathOf(meetup, locale);

    test.beforeAll(() => seed(meetup));

    test.afterAll(() => cleanup(meetup));

    test('takes the seat once sign-in brings the reader back', async ({
      page,
    }) => {
      test.setTimeout(150_000);
      await page.goto(path);
      await pressJoinSignedOut(page, locale);

      await signIn(page, locale, meetup.memberEmail, 'login_email_continue');
      await page.waitForURL((url) => url.pathname === path, {
        timeout: 60_000,
      });

      await expect(
        page.getByRole('heading', { name: t(locale, 'rsvp_already') }),
        'on 2 October a reader pressed Join, signed in, came back to the same button and left without pressing it again',
      ).toBeVisible({ timeout: 30_000 });
      await expect(
        page.getByRole('button', { name: t(locale, 'rsvp_cta') }),
      ).toBeHidden();
      expect(seatsOf(meetup)).toBe(1);

      await page.reload();
      await expect(
        page.getByRole('heading', { name: t(locale, 'rsvp_already') }),
      ).toBeVisible({ timeout: 30_000 });
      expect(seatsOf(meetup)).toBe(1);
    });
  });
}
