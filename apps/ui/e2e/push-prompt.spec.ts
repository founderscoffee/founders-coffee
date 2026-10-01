import { expect, test, type Locator, type Page } from '@playwright/test';

import { cleanupRun, d1 } from './support/d1';
import { t, type E2eLocale } from './support/messages';
import { signInBackTo } from './support/profile-auth';
import { newId, RUN_ID } from './support/run';

const LOCALES: readonly E2eLocale[] = ['ar', 'fr', 'en'];
const WIDTHS = [320, 360, 640, 1280] as const;
const DAY_SECONDS = 86_400;

/** The rows one locale's run writes, named by its locale and the run so parallel runs never meet. */
const meetupFor = (locale: E2eLocale) => ({
  eventId: newId('evt'),
  hostId: `usr_e2e_push_prompt_${locale}_${RUN_ID}`,
  hostEmail: `e2e-push-prompt-host-${locale}-${RUN_ID}@e2e.invalid`,
  memberEmail: `e2e-push-prompt-member-${locale}-${RUN_ID}@e2e.invalid`,
  slug: `e2e-push-prompt-${locale}-${RUN_ID}`,
});

type Meetup = ReturnType<typeof meetupFor>;

/** A meetup in Algiers two days away, with nobody going yet. */
const seed = (meetup: Meetup): void => {
  const startsAt = Math.floor(Date.now() / 1000) + 2 * DAY_SECONDS;
  d1(
    `INSERT INTO user (id, name, email) VALUES ('${meetup.hostId}', 'Host ${RUN_ID}', '${meetup.hostEmail}'); ` +
      `INSERT INTO events (id, host_id, market_code, state_code, city_code, title, description, venue, starts_at, ends_at, language, languages, slug) ` +
      `VALUES ('${meetup.eventId}', '${meetup.hostId}', 'DZ', '16', '556', 'E2E push prompt ${RUN_ID}', 'Seeded for the notification prompt.', 'Café E2E', ${startsAt}, ${startsAt + 7_200}, 'ar', json_array('ar'), '${meetup.slug}');`,
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
 * Present the browser as one that has not answered the notification question yet, as a phone does
 * before its first RSVP. Headless Chromium answers `denied` on every page, and the prompt only opens
 * for a browser that has not decided.
 */
const undecidedAboutNotifications = async (page: Page): Promise<void> => {
  await page.addInitScript(() => {
    Object.defineProperty(Notification, 'permission', {
      get: () => 'default',
    });
  });
};

/**
 * RSVP from the meetup page and return the notification prompt the RSVP opens.
 *
 * The button is server-rendered, and a click that lands before React hydrates it does nothing, so
 * it is clicked again until the prompt shows.
 */
const joinUntilPrompted = async (
  page: Page,
  locale: E2eLocale,
): Promise<Locator> => {
  const join = page.getByRole('button', { name: t(locale, 'rsvp_cta') });
  const prompt = page.getByRole('dialog', {
    name: t(locale, 'push_prompt_title'),
  });
  await expect(async () => {
    if (await join.isVisible()) await join.click({ timeout: 2_000 });
    await expect(prompt).toBeVisible({ timeout: 3_000 });
  }).toPass({ timeout: 30_000 });
  return prompt;
};

/**
 * How many whole pixels the prompt's buttons reach outside its box's content area, 0 when both fit.
 *
 * A daisyUI button neither wraps nor shrinks, so a row too long for the box runs out at the side
 * its buttons are packed away from, where the box clips it and `scrollWidth` never counts it. The
 * rectangles are compared once the box has finished opening, since it scales in.
 */
const reachOutside = (prompt: Locator): Promise<number> =>
  prompt.locator('.modal-box').evaluate(async (box) => {
    await Promise.all(
      box
        .getAnimations({ subtree: true })
        .map((animation) => animation.finished),
    );
    const style = getComputedStyle(box);
    const outer = box.getBoundingClientRect();
    const left =
      outer.left +
      parseFloat(style.borderLeftWidth) +
      parseFloat(style.paddingLeft);
    const right =
      outer.right -
      parseFloat(style.borderRightWidth) -
      parseFloat(style.paddingRight);
    const reach = [...box.querySelectorAll('.modal-action button')].map(
      (button) => {
        const rect = button.getBoundingClientRect();
        return Math.max(left - rect.left, rect.right - right);
      },
    );
    return Math.max(0, Math.round(Math.max(...reach)));
  });

test.describe('The notification prompt an RSVP opens', () => {
  for (const locale of LOCALES) {
    test(`keeps both of its buttons inside the dialog from 320px up (${locale})`, async ({
      page,
    }, testInfo) => {
      test.setTimeout(150_000);
      const meetup = meetupFor(locale);
      seed(meetup);
      try {
        await undecidedAboutNotifications(page);
        await signInBackTo(
          page,
          locale,
          meetup.memberEmail,
          pathOf(meetup, locale),
        );
        const prompt = await joinUntilPrompted(page, locale);
        const outside: Record<number, number> = {};
        for (const width of WIDTHS) {
          await page.setViewportSize({ width, height: 800 });
          outside[width] = await reachOutside(prompt);
          await prompt.locator('.modal-box').screenshot({
            path: testInfo.outputPath(`prompt-${width}.png`),
            animations: 'disabled',
          });
        }
        expect(outside).toEqual(
          Object.fromEntries(WIDTHS.map((width) => [width, 0])),
        );
      } finally {
        cleanup(meetup);
      }
    });
  }
});
