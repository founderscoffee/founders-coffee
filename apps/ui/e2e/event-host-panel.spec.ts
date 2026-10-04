import { expect, test, type Page } from '@playwright/test';

import { cleanupRun, d1 } from './support/d1';
import { t, type E2eLocale } from './support/messages';
import { signInBackTo } from './support/profile-auth';
import { newId, RUN_ID } from './support/run';

const HOST = {
  id: `usr_e2e_panel_host_${RUN_ID}`,
  email: `e2e-panel-host-${RUN_ID}@e2e.invalid`,
};

const MEETUP = {
  id: newId('evt'),
  slug: `e2e-host-panel-${RUN_ID}`,
};

const LOCALES: readonly E2eLocale[] = ['ar', 'fr', 'en'];

const WIDTHS = [320, 360, 768, 1024, 1280, 1920] as const;

const TWO_COLUMNS = 1024;

const DAY_SECONDS = 86_400;

const pathIn = (locale: E2eLocale) => `/${locale}/algeria/e/${MEETUP.slug}`;

/** A meetup in Algiers three days out, hosted by an account that signs in by email. */
const seed = (): void => {
  const startsAt = Math.floor(Date.now() / 1000) + 3 * DAY_SECONDS;
  d1(
    `INSERT INTO user (id, name, email) VALUES ('${HOST.id}', 'Amina Panel', '${HOST.email}'); ` +
      `INSERT INTO events (id, host_id, market_code, state_code, city_code, title, description, venue, starts_at, ends_at, language, slug) ` +
      `VALUES ('${MEETUP.id}', '${HOST.id}', 'DZ', '16', '556', 'E2E host panel ${RUN_ID}', 'Seeded for the host panel.', 'Café E2E', ${startsAt}, ${startsAt + 7200}, 'ar', '${MEETUP.slug}');`,
  );
};

const cleanup = (): void =>
  cleanupRun({ eventIds: [MEETUP.id], emails: [HOST.email] });

/**
 * Where the host's panel, the boxes beside it and each of the panel's buttons sit, in one layout
 * pass.
 *
 * The buttons of the panel's closed dialogs are left out: they are in the panel's markup but not
 * on the page. `calendar` and `chat` are the tops of the two buttons that share the second row,
 * `chat` null where the market has its chat off.
 */
const measure = (page: Page) =>
  page.evaluate(() => {
    const box = (element: Element | null | undefined) => {
      if (!element) return null;
      const { top, bottom, left, right } = element.getBoundingClientRect();
      return { top, bottom, left, right };
    };
    const panel = document.querySelector(
      'section[aria-labelledby="event-rsvp-title"]',
    );
    const details = document.querySelector(
      'section[aria-labelledby="event-details-title"]',
    );
    const hostCard = details?.querySelector(':scope > section');
    const buttons = [...(panel?.querySelectorAll('.btn') ?? [])].filter(
      (button) => !button.closest('dialog'),
    );
    return {
      overflow: document.documentElement.scrollWidth - window.innerWidth,
      panel: box(panel),
      when: box(details?.querySelector('dl > div')),
      hostCard: box(hostCard),
      badgeInCard: Boolean(hostCard?.querySelector('.bg-success-tint')),
      badgeInPanel: Boolean(panel?.querySelector('.bg-success-tint')),
      buttons: buttons.map((button) => {
        const { left, right } = button.getBoundingClientRect();
        return {
          label: button.textContent?.trim() ?? '',
          left,
          right,
          isCut: button.scrollWidth > button.clientWidth + 1,
        };
      }),
      edit: box(panel?.querySelector('a.btn'))?.top ?? null,
      cancel: box(panel?.querySelector('button.btn-error'))?.top ?? null,
      calendar: box(panel?.querySelector('summary'))?.top ?? null,
      chat:
        box(panel?.querySelector('button[aria-haspopup="dialog"]'))?.top ??
        null,
    };
  });

test.describe("The host's panel beside the meetup details", () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(() => {
    cleanup();
    seed();
  });
  test.afterAll(cleanup);

  test('keeps each pair of actions on one line and ends level with the details', async ({
    page,
  }) => {
    test.setTimeout(240_000);
    await signInBackTo(page, 'ar', HOST.email, pathIn('ar'));

    for (const locale of LOCALES)
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(pathIn(locale));
        await expect(
          page
            .getByRole('region', { name: t(locale, 'event_details_title') })
            .getByText(t(locale, 'host_you_are_hosting')),
        ).toBeVisible({ timeout: 30_000 });
        await page.evaluate(() => document.fonts.ready);
        const at = await measure(page);
        const where = `${locale} at ${width}px`;

        expect(at.overflow, `${where}: the page scrolls sideways`).toBe(0);
        expect(
          at.badgeInCard && !at.badgeInPanel,
          `${where}: the badge belongs to the card that names the host`,
        ).toBe(true);
        expect(at.edit, `${where}: Edit and Cancel share a line`).toBe(
          at.cancel,
        );
        if (at.chat !== null)
          expect(
            at.chat,
            `${where}: the calendar and the chat share a line`,
          ).toBe(at.calendar);
        for (const button of at.buttons) {
          expect(button.isCut, `${where}: "${button.label}" is cut off`).toBe(
            false,
          );
          expect(
            button.left >= (at.panel?.left ?? 0) &&
              button.right <= (at.panel?.right ?? 0),
            `${where}: "${button.label}" runs past the panel`,
          ).toBe(true);
        }
        if (width >= TWO_COLUMNS) {
          expect(
            Math.abs((at.panel?.top ?? 0) - (at.when?.top ?? 0)),
            `${where}: the panel starts level with the When box`,
          ).toBeLessThanOrEqual(1);
          expect(
            Math.abs((at.panel?.bottom ?? 0) - (at.hostCard?.bottom ?? 0)),
            `${where}: the panel ends level with the host card`,
          ).toBeLessThanOrEqual(1);
        }
      }
  });
});
