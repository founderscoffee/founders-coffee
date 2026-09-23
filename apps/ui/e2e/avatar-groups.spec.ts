import { expect, test, type Locator, type Page } from '@playwright/test';

import { d1 } from './support/d1';

const ALGIERS = {
  code: '556',
  state: '16',
  heading: 'market-city-algeria-algiers',
};

const HOSTS = ['Amina', 'Bilal', 'Chahra', 'Djamel'].map((name, index) => ({
  id: `usr_e2e_face_${index}`,
  name: `${name} E2E`,
  eventId: `evt_e2e_face_${index}`,
  slug: `e2e-face-${index}`,
  title: `E2E avatar group ${index}`,
}));

const quoted = (values: readonly string[]): string =>
  values.map((value) => `'${value}'`).join(', ');

/**
 * Remove the hosts and meetups this spec seeds, addressed by their exact identifiers.
 *
 * It runs before seeding as well as after, so a run that died half way cannot leave a second copy
 * of the same rows for the next one to trip over.
 */
const cleanup = (): void => {
  d1(
    `DELETE FROM events WHERE id IN (${quoted(HOSTS.map((host) => host.eventId))}); ` +
      `DELETE FROM user WHERE id IN (${quoted(HOSTS.map((host) => host.id))});`,
  );
};

/**
 * Four named hosts, each with a meetup in Algiers over the next few hours.
 *
 * Starting sooner than anything else in the city is what puts all four in front: their faces lead
 * the Algiers city card, which then has more hosts than faces and so draws its counter, and the
 * first meetup leads the market's list. Its three RSVPs give its event card the host's face and a
 * "+2". Nothing depends on what else the local database holds.
 */
const seed = (): void => {
  cleanup();
  const now = Math.floor(Date.now() / 1000);
  d1(
    `INSERT INTO user (id, name, email) VALUES ${HOSTS.map(
      (host) => `('${host.id}', '${host.name}', '${host.id}@e2e.test')`,
    ).join(', ')}; ` +
      `INSERT INTO events (id, host_id, market_code, state_code, city_code, title, description, venue, starts_at, rsvps, language, slug) VALUES ${HOSTS.map(
        (host, index) =>
          `('${host.eventId}', '${host.id}', 'DZ', '${ALGIERS.state}', '${ALGIERS.code}', '${host.title}', 'Seeded to measure avatar groups.', 'Café E2E', ${now + (index + 1) * 3600}, ${index === 0 ? 3 : 1}, 'fr', '${host.slug}')`,
      ).join(', ')};`,
  );
};

/**
 * How the avatars of one group sit against each other and against the group's own box.
 *
 * `overlaps` is how far each avatar reaches under the one before it, whichever way the page reads,
 * and `overhang` is how far any of them strays outside the group. `isCountReadable` says whether
 * both ends of the counter's text are what a reader sees there, rather than a face painted over
 * them. Markup cannot answer any of this: the group that shipped with no overlap and a face hanging
 * out of it carried `-space-x-3`, which reads as correct, beside `rtl:space-x-reverse`, which Tailwind
 * 4's logical spacing turns into the opposite.
 */
const measureGroup = async (group: Locator) =>
  group.evaluate((element) => {
    element.scrollIntoView({ block: 'center', behavior: 'instant' });
    const box = element.getBoundingClientRect();
    const members = [...element.children].map((child) =>
      child.getBoundingClientRect(),
    );
    const overlaps = members
      .slice(1)
      .map((member, index) =>
        Math.round(
          Math.min(members[index].right, member.right) -
            Math.max(members[index].left, member.left),
        ),
      );
    const overhang = Math.max(
      0,
      ...members.map((member) =>
        Math.round(Math.max(box.left - member.left, member.right - box.right)),
      ),
    );
    const counter = element.lastElementChild;
    const text = counter?.querySelector('[dir="ltr"]');
    if (!counter || !text) return { overlaps, overhang, isCountReadable: null };
    const range = document.createRange();
    range.selectNodeContents(text);
    const glyphs = range.getBoundingClientRect();
    const middle = (glyphs.top + glyphs.bottom) / 2;
    const isCountReadable = [glyphs.left + 1, glyphs.right - 1].every((x) =>
      counter.contains(document.elementFromPoint(x, middle)),
    );
    return { overlaps, overhang, isCountReadable };
  });

/**
 * Whether the host's face comes before their name in the direction the page reads.
 *
 * The event card's host line used to force right-to-left on every page, which put the name first
 * and the face after it on a French or English page.
 */
const isFaceFirst = async (page: Page, card: Locator) => {
  const face = await card.locator('.avatar-group').boundingBox();
  const name = await card.locator('footer bdi').boundingBox();
  const isRightToLeft = await page.evaluate(
    () => getComputedStyle(document.documentElement).direction === 'rtl',
  );
  if (!face || !name) return null;
  return isRightToLeft
    ? face.x >= name.x + name.width
    : face.x + face.width <= name.x;
};

test.describe('Avatar groups', () => {
  test.describe.configure({ mode: 'serial' });
  test.beforeAll(seed);
  test.afterAll(cleanup);

  for (const locale of ['fr', 'ar', 'en']) {
    test(`overlap inside their own box and keep the count on top (${locale})`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/algeria`);
      const groups = {
        'city card': page
          .locator('li')
          .filter({ has: page.locator(`#${ALGIERS.heading}`) })
          .locator('.avatar-group'),
        'event card': page
          .locator('article')
          .filter({ hasText: HOSTS[0].title })
          .locator('.avatar-group'),
      };

      for (const [where, group] of Object.entries(groups)) {
        await expect(group, `the ${where} draws no avatar group`).toHaveCount(
          1,
        );
        const { overlaps, overhang, isCountReadable } =
          await measureGroup(group);

        expect(overlaps.length, `the ${where} has one avatar`).toBeGreaterThan(
          0,
        );
        expect(
          overlaps.every((overlap) => overlap > 0),
          `the ${where}'s avatars sit apart instead of overlapping: ${overlaps.join(', ')}px`,
        ).toBe(true);
        expect(
          new Set(overlaps).size,
          `the ${where}'s avatars overlap unevenly: ${overlaps.join(', ')}px`,
        ).toBe(1);
        expect(overhang, `an avatar hangs out of the ${where}'s group`).toBe(0);
        expect(
          isCountReadable,
          `the ${where}'s count is missing or has a face painted over it`,
        ).toBe(true);
      }
    });

    test(`puts the host's face before their name (${locale})`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/algeria`);
      const card = page.locator('article').filter({ hasText: HOSTS[0].title });

      expect(await isFaceFirst(page, card)).toBe(true);
    });
  }
});
