import { MAX_TITLE_LENGTH, SITE_NAME, namesTheBrand } from './seo';

const TRAILING_JOINERS = /[\s·,،:;\-–—]+$/u;
const ENDS_A_SENTENCE = /[.!?؟…]$/u;

/**
 * Text cut to `maxLength` code points at its last whole word, with an ellipsis where words were lost.
 *
 * Cutting wherever the count runs out leaves half a word: a meetup's title lost its city to
 * "· ال…". The cut goes back to the last space, then past any separator it left hanging, and a cut
 * that ends a sentence needs no ellipsis to say so. A text with nowhere to cut is cut where the
 * count runs out.
 */
export const clipAtWord = (value: string, maxLength: number): string => {
  const normalized = value.replace(/\s+/gu, ' ').trim();
  const codePoints = Array.from(normalized);
  if (codePoints.length <= maxLength) return normalized;
  const head = codePoints.slice(0, maxLength - 1).join('');
  const lastSpace = head.lastIndexOf(' ');
  const cut = (lastSpace > 0 ? head.slice(0, lastSpace) : head).replace(
    TRAILING_JOINERS,
    '',
  );
  return ENDS_A_SENTENCE.test(cut) ? cut : `${cut}…`;
};

/**
 * A `<title>` that leads with the page's own words and names the brand after them when there is room.
 *
 * `buildPageTitle` puts the brand first, which suits the site's own pages and spends the start of a
 * search result, the part a reader sees, on a name the address already shows. Here `parts` run from
 * most to least important. Whatever does not fit the length a result shows goes from the end, the
 * brand first, and a first part too long on its own is cut at a word.
 */
export const buildLeadingTitle = (parts: readonly string[]): string => {
  const kept = parts
    .map((part) => part.replace(/\s+/gu, ' ').trim())
    .filter(Boolean);
  if (kept.length === 0) return SITE_NAME;
  const whole = kept.join(' · ');
  const candidates = [
    namesTheBrand(whole) ? whole : `${whole} - ${SITE_NAME}`,
    ...kept.map((_, dropped) =>
      kept.slice(0, kept.length - dropped).join(' · '),
    ),
  ];
  return (
    candidates.find(
      (candidate) => Array.from(candidate).length <= MAX_TITLE_LENGTH,
    ) ?? clipAtWord(kept[0], MAX_TITLE_LENGTH)
  );
};
