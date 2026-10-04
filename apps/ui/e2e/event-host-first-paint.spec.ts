import { expect, test, type Page } from '@playwright/test';

import { cleanupRun, d1 } from './support/d1';
import { t, type E2eLocale } from './support/messages';
import { signInBackTo } from './support/profile-auth';
import { newId, RUN_ID } from './support/run';

const HOST = {
  id: `usr_e2e_first_paint_${RUN_ID}`,
  email: `e2e-first-paint-host-${RUN_ID}@e2e.invalid`,
};

const LIVE = { id: newId('evt'), slug: `e2e-first-paint-live-${RUN_ID}` };

const UPCOMING = { id: newId('evt'), slug: `e2e-first-paint-next-${RUN_ID}` };

const LOCALES: readonly E2eLocale[] = ['ar', 'fr', 'en'];

const WIDTHS = [360, 1280] as const;

const MINUTE_SECONDS = 60;

const DAY_SECONDS = 86_400;

type Meetup = typeof LIVE;

const pathOf = (meetup: Meetup, locale: E2eLocale): string =>
  `/${locale}/algeria/e/${meetup.slug}`;

/** One meetup in its live hour, started ten minutes ago, and one three days out, both in Algiers and hosted by one account. */
const seed = (): void => {
  const now = Math.floor(Date.now() / 1000);
  const row = (meetup: Meetup, startsAt: number, endsAt: number): string =>
    `('${meetup.id}', '${HOST.id}', 'DZ', '16', '556', 'E2E first paint ${meetup.slug}', 'Seeded for the first paint of a host page.', 'Café E2E', ${startsAt}, ${endsAt}, 'ar', json_array('ar'), '${meetup.slug}')`;
  const upcoming = now + 3 * DAY_SECONDS;
  d1(
    `INSERT INTO user (id, name, email) VALUES ('${HOST.id}', 'Host First Paint', '${HOST.email}'); ` +
      `INSERT INTO events (id, host_id, market_code, state_code, city_code, title, description, venue, starts_at, ends_at, language, languages, slug) VALUES ` +
      `${row(LIVE, now - 10 * MINUTE_SECONDS, now + 50 * MINUTE_SECONDS)}, ${row(UPCOMING, upcoming, upcoming + 7_200)};`,
  );
};

const cleanup = (): void =>
  cleanupRun({ eventIds: [LIVE.id, UPCOMING.id], emails: [HOST.email] });

/**
 * Write down every heading the RSVP box shows, from the moment the document starts.
 *
 * Installed before any of the page's own scripts run, so it sees the box as the server sent it,
 * through hydration and the session's answer. A guest's heading that is in the document for any
 * stretch at all is recorded, which a `toHaveText` poll would miss: it waits for the host's
 * heading and passes once it arrives, however long the guest's was on screen first.
 */
const recordRsvpHeadings = (): void => {
  const seen: string[] = [];
  Object.assign(window, { rsvpHeadings: seen });
  const read = () => {
    const text = document.getElementById('event-rsvp-title')?.textContent;
    if (text && seen.at(-1) !== text) seen.push(text);
  };
  new MutationObserver(read).observe(document, {
    childList: true,
    subtree: true,
    characterData: true,
  });
};

const headingsOf = (page: Page): Promise<string[]> =>
  page.evaluate(
    () => (window as unknown as { rsvpHeadings: string[] }).rsvpHeadings,
  );

/** The header's menu for the member, rendered once the browser's session has answered after hydration. */
const memberMenu = (page: Page, locale: E2eLocale) =>
  page.locator(`summary[aria-label="${t(locale, 'profile_title')}"]`);

/** Wait for the session to answer, then check the box never showed the host anything but their own panel. */
const expectOnlyTheHostsPanel = async (
  page: Page,
  locale: E2eLocale,
  where: string,
): Promise<void> => {
  await expect(memberMenu(page, locale)).toBeVisible({ timeout: 30_000 });
  expect(
    await headingsOf(page),
    `${where}: the RSVP box showed a guest's heading before the host's panel; the server rendered the session as still resolving and the route took the host from it, so the panel waited for the browser's session request after hydration`,
  ).toEqual([t(locale, 'rsvp_box_host')]);
};

test.describe("A host's own meetup page", () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(() => {
    cleanup();
    seed();
  });
  test.afterAll(cleanup);

  test("shows the host's panel from the first paint, and a guest's box once they sign out", async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await page.addInitScript(recordRsvpHeadings);
    await page.setViewportSize({ width: WIDTHS[0], height: 800 });
    await signInBackTo(page, 'ar', HOST.email, pathOf(UPCOMING, 'ar'));
    await expectOnlyTheHostsPanel(
      page,
      'ar',
      'ar, the page sign-in sent the host back to',
    );

    for (const locale of LOCALES)
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 800 });
        await page.goto(pathOf(LIVE, locale));
        await expectOnlyTheHostsPanel(
          page,
          locale,
          `${locale} at ${width}px, in the live hour`,
        );
      }

    await page.evaluate(() => Object.assign(window, { isSameDocument: true }));
    await memberMenu(page, 'en').click();
    await page
      .getByRole('button', { name: t('en', 'sign_out'), exact: true })
      .click();

    await expect(page.locator('#event-rsvp-title')).toHaveText(
      t('en', 'rsvp_box_closed'),
      { timeout: 30_000 },
    );
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { isSameDocument?: boolean }).isSameDocument,
      ),
      'signing out from the header loads no new document',
    ).toBe(true);
    expect(await headingsOf(page)).toEqual([
      t('en', 'rsvp_box_host'),
      t('en', 'rsvp_box_closed'),
    ]);
  });

  test("shows a guest's box to a host who signed out on another page and went back to it", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    await page.addInitScript(recordRsvpHeadings);
    await page.setViewportSize({ width: WIDTHS[1], height: 800 });
    await signInBackTo(page, 'en', HOST.email, pathOf(UPCOMING, 'en'));
    await expectOnlyTheHostsPanel(
      page,
      'en',
      'en, the page sign-in sent the host back to',
    );

    await page.evaluate(() => Object.assign(window, { isSameDocument: true }));
    await page
      .getByRole('link', { name: t('en', 'brand'), exact: true })
      .locator('visible=true')
      .first()
      .click();
    await expect(page).not.toHaveURL(/\/e\//u);
    await memberMenu(page, 'en').click();
    await page
      .getByRole('button', { name: t('en', 'sign_out'), exact: true })
      .click();
    await expect(memberMenu(page, 'en')).toBeHidden({ timeout: 30_000 });

    await page.evaluate(() => {
      (window as unknown as { rsvpHeadings: string[] }).rsvpHeadings.length = 0;
    });
    await page.goBack();
    await expect(page.locator('#event-rsvp-title')).toHaveText(
      t('en', 'rsvp_box_title'),
      { timeout: 30_000 },
    );
    expect(
      await page.evaluate(
        () =>
          (window as unknown as { isSameDocument?: boolean }).isSameDocument,
      ),
      'the sign-out and Back load no new document, so the router shows the page it kept',
    ).toBe(true);
    expect(
      await headingsOf(page),
      'Back showed the meetup as the router had kept it, loaded for its host, to the reader who had just signed out, until it loaded again',
    ).toEqual([t('en', 'rsvp_box_title')]);
  });
});
