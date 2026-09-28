import { expect, test, type Page } from '@playwright/test';

import { d1 } from './support/d1';

const HOST = { id: 'usr_e2e_details', name: 'Amina Details' };

const MEETUP = {
  id: 'evt_e2e_details',
  slug: 'e2e-meetup-details',
  venue: 'Café Atlas',
  address: '12 Rue Didouche Mourad, Alger',
};

const NOTE = {
  ar: 'التوقيت المحلي في الجزائر',
  fr: 'Heure locale d’Algérie',
  en: 'Local time in Algeria',
} as const;

/**
 * Remove the host and meetup this spec seeds, addressed by their exact identifiers.
 *
 * It runs before seeding as well as after, so a run that died half way cannot leave a copy behind
 * for the next one to trip over.
 */
const cleanup = (): void => {
  d1(
    `DELETE FROM events WHERE id = '${MEETUP.id}'; ` +
      `DELETE FROM user WHERE id = '${HOST.id}';`,
  );
};

/**
 * A host whose name is written in Latin letters, with a meetup in Algiers two days out.
 *
 * The venue and its address are Latin too. On an Arabic page these are the lines that drifted to
 * the far side of their box: text that sets its own direction also aligned itself by it.
 */
const seed = (): void => {
  cleanup();
  const startsAt = Math.floor(Date.now() / 1000) + 2 * 86_400;
  d1(
    `INSERT INTO user (id, name, email) VALUES ('${HOST.id}', '${HOST.name}', '${HOST.id}@e2e.test'); ` +
      `INSERT INTO events (id, host_id, market_code, state_code, city_code, title, description, venue, venue_address, starts_at, ends_at, rsvps, language, slug) VALUES ('${MEETUP.id}', '${HOST.id}', 'DZ', '16', '556', 'E2E meetup details', 'Seeded to measure the details boxes.', '${MEETUP.venue}', '${MEETUP.address}', ${startsAt}, ${startsAt + 7200}, 0, 'fr', '${MEETUP.slug}');`,
  );
};

/** The section that holds the When and Where boxes and the host card. */
const details = (page: Page) =>
  page.locator('[aria-labelledby="event-details-title"]');

/**
 * Where each line of the When, Where and host boxes begins, on the side the page starts reading.
 *
 * Lines are measured on their text, not their boxes: a block that stretches across its box looks
 * aligned in markup whichever side its words sit on. `time` and `note` also report their tops, so
 * a caller can tell whether they share a line, and `noteLines` says how many lines the note took.
 */
const measure = (page: Page) =>
  page.evaluate((hostName) => {
    const isRightToLeft =
      getComputedStyle(document.documentElement).direction === 'rtl';
    const start = (element: Element | null | undefined): number => {
      if (!element) return Number.NaN;
      const range = document.createRange();
      range.selectNodeContents(element);
      const rects = [...range.getClientRects()].filter((rect) => rect.width);
      return isRightToLeft
        ? Math.max(...rects.map((rect) => rect.right))
        : Math.min(...rects.map((rect) => rect.left));
    };
    const [when, where] = document.querySelectorAll('dl > div');
    const [day, timeLine] = when?.querySelectorAll('dd') ?? [];
    const [venue, address] = where?.querySelectorAll('dd') ?? [];
    const [time, note] =
      timeLine?.querySelectorAll(':scope > span > span') ?? [];
    const details = document.querySelector(
      '[aria-labelledby="event-details-title"]',
    );
    const name = [...(details?.querySelectorAll('bdi') ?? [])].find(
      (element) => element.textContent === hostName,
    );
    const city = name?.parentElement?.nextElementSibling;
    const icon = (row: Element | undefined) => {
      const svg = row?.querySelector('svg');
      if (!svg) return null;
      const box = svg.getBoundingClientRect();
      return {
        start: isRightToLeft ? box.right : box.left,
        size: `${box.width}x${box.height}`,
        color: getComputedStyle(svg).color,
      };
    };
    return {
      calendar: icon(day),
      pin: icon(venue),
      day: start(day?.querySelector('time')),
      venue: start(venue?.querySelector('bdi')),
      address: start(address),
      time: start(time),
      note: start(note),
      timeTop: time?.getBoundingClientRect().top ?? Number.NaN,
      noteTop: note?.getBoundingClientRect().top ?? Number.NaN,
      noteLines: new Set(
        [...(note?.getClientRects() ?? [])].map((rect) => rect.top),
      ).size,
      noteText: note?.textContent ?? '',
      name: start(name),
      city: start(city),
    };
  }, HOST.name);

test.describe('The meetup details', () => {
  test.describe.configure({ mode: 'serial' });
  test.use({ viewport: { width: 360, height: 800 } });
  test.beforeAll(seed);
  test.afterAll(cleanup);

  for (const locale of ['ar', 'fr', 'en'] as const) {
    test(`start every line on the side the page reads from (${locale})`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/algeria/e/${MEETUP.slug}`);
      await expect(details(page).getByText(HOST.name)).toBeVisible();
      const at = await measure(page);

      expect(at.calendar, 'the date has no calendar icon').not.toBeNull();
      expect(at.calendar?.size).toBe(at.pin?.size);
      expect(at.calendar?.color).toBe(at.pin?.color);
      expect(at.calendar?.start).toBeCloseTo(at.pin?.start ?? Number.NaN, 0);
      expect(
        at.day,
        'the date does not start where the venue does',
      ).toBeCloseTo(at.venue, 0);
      expect(at.time, 'the time is not under the date').toBeCloseTo(at.day, 0);
      expect(at.address, 'a Latin address is not under its venue').toBeCloseTo(
        at.venue,
        0,
      );
      expect(
        at.name,
        'a Latin name is not beside the avatar, where the city under it starts',
      ).toBeCloseTo(at.city, 0);
      expect(at.noteText).toBe(NOTE[locale]);
      expect(at.noteTop, 'the time is not on the local-time line').toBe(
        at.timeTop,
      );
    });
  }

  test('moves the whole local-time note under the time when both do not fit', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 800 });
    await page.goto(`/fr/algeria/e/${MEETUP.slug}`);
    await expect(details(page).getByText(HOST.name)).toBeVisible();
    const at = await measure(page);

    expect(at.noteTop).toBeGreaterThan(at.timeTop);
    expect(
      at.noteLines,
      'the note broke inside itself instead of taking a line of its own',
    ).toBe(1);
    expect(at.note).toBeCloseTo(at.time, 0);
  });
});
