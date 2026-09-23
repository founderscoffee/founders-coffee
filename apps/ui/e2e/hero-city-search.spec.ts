import { expect, test, type Page } from '@playwright/test';

const LISTBOX_ID = 'hero-city-listbox';

/**
 * Each city card the open suggestion list overlaps, and whether the list is what a reader sees in
 * the middle of that overlap.
 *
 * Which of two boxes paints on top is settled by stacking contexts, and no markup assertion can
 * read those: the list carried `z-20` the whole time it sat under the cards, because the hero it
 * opens from is a stacking context of its own and every card after it is positioned. Only the
 * browser knows what is on top, so this asks `elementFromPoint` rather than the class list.
 */
const overlappedCards = async (page: Page) =>
  page.evaluate((listboxId) => {
    const list = document.getElementById(listboxId);
    if (!list) return null;
    const box = list.getBoundingClientRect();
    const cards = document.querySelectorAll(
      '[aria-labelledby="market-cities-title"] li',
    );
    return [...cards].flatMap((card) => {
      const other = card.getBoundingClientRect();
      const left = Math.max(box.left, other.left);
      const right = Math.min(box.right, other.right);
      const top = Math.max(box.top, other.top);
      const bottom = Math.min(box.bottom, other.bottom, window.innerHeight);
      if (right - left < 8 || bottom - top < 8) return [];
      const seen = document.elementFromPoint(
        (left + right) / 2,
        (top + bottom) / 2,
      );
      return [
        {
          card: card.textContent?.trim() ?? '',
          isListOnTop: list.contains(seen),
        },
      ];
    });
  }, LISTBOX_ID);

/**
 * Scroll the open list up under the sticky header, and report whether the header is what a reader
 * sees where the two meet.
 *
 * Lifting the hero is only right while it stays below the header, and nothing else on the page
 * says so. Returns null when the scroll could not bring the two together, so a layout change
 * cannot quietly turn this into a check of nothing.
 */
const isHeaderOverList = async (page: Page) =>
  page.getByRole('banner').evaluate((header, listboxId) => {
    const list = document.getElementById(listboxId);
    if (!list) return null;
    window.scrollTo({
      top:
        window.scrollY +
        list.getBoundingClientRect().top -
        header.getBoundingClientRect().bottom +
        40,
      behavior: 'instant',
    });
    const box = list.getBoundingClientRect();
    const bar = header.getBoundingClientRect();
    const left = Math.max(box.left, bar.left);
    const right = Math.min(box.right, bar.right);
    const top = Math.max(box.top, bar.top);
    const bottom = Math.min(box.bottom, bar.bottom);
    if (right - left < 8 || bottom - top < 8) return null;
    return header.contains(
      document.elementFromPoint((left + right) / 2, (top + bottom) / 2),
    );
  }, LISTBOX_ID);

/**
 * Type into the hero search until it offers suggestions.
 *
 * The input is server-rendered and answers keystrokes only once React has hydrated it, which on a
 * cold dev server lands well after `load`. A letter typed before that sets the DOM value and
 * never reaches the component, so this types again until the list opens instead of guessing how
 * long hydration takes.
 */
const openSuggestions = async (page: Page, query: string) => {
  const search = page.getByRole('combobox');
  const firstOption = page.getByRole('option').first();
  await expect(async () => {
    await search.fill('');
    await search.fill(query);
    await expect(firstOption).toBeVisible({ timeout: 1_000 });
  }).toPass({ timeout: 30_000 });
};

test.describe('Hero city search', () => {
  for (const path of ['/fr/algeria', '/ar/algeria']) {
    test(`opens its suggestions above the city cards below it (${path})`, async ({
      page,
    }) => {
      await page.goto(path);
      await openSuggestions(page, 'd');

      const overlaps = await overlappedCards(page);

      expect(
        overlaps?.length,
        'the open list does not reach the city cards, so nothing here is being tested',
      ).toBeGreaterThan(0);
      expect(
        overlaps
          ?.filter((overlap) => !overlap.isListOnTop)
          .map((overlap) => overlap.card),
        'these city cards are painted over the open suggestion list',
      ).toEqual([]);
    });
  }

  test('keeps its open suggestions under the sticky header', async ({
    page,
  }) => {
    await page.goto('/fr/algeria');
    await openSuggestions(page, 'd');

    const isHeaderOnTop = await isHeaderOverList(page);

    expect(
      isHeaderOnTop,
      'scrolling never brought the list under the header, so nothing here is being tested',
    ).not.toBeNull();
    expect(
      isHeaderOnTop,
      'the open suggestion list is painted over the sticky header',
    ).toBe(true);
  });
});
