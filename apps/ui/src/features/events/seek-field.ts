import { VENUE_LIST_ID, VENUE_SEARCH_INPUT_ID } from './types';

/**
 * Take the host to `element`, a field Next found holding the step back, without a word: focus it,
 * mark it so it wears the focus ring even after a tap or a click (the browser keeps the ring for
 * the keyboard alone), and scroll only as far as it takes to show it. The mark leaves with the
 * focus.
 */
export const seekField = (element: HTMLElement): void => {
  element.setAttribute('data-sought', '');
  element.addEventListener(
    'blur',
    () => element.removeAttribute('data-sought'),
    { once: true },
  );
  element.focus({ preventScroll: true });
  element.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' });
};

/**
 * Take the host to the first place listed, the one the list's arrow keys start from, as Next does
 * with no place chosen and the map does after a tap it found no address for. Returns whether a
 * place was there to offer, so the caller can turn to the search instead.
 */
export const seekFirstPlace = (): boolean => {
  const place = document.querySelector<HTMLElement>(
    `#${VENUE_LIST_ID} [role="option"][tabindex="0"]`,
  );
  if (place) seekField(place);
  return place !== null;
};

/**
 * Take the host to the first place listed, or to the search box where the list offers none, on a
 * page whose search box is always there, as the edit page's is.
 */
export const seekPlaceOrSearch = (): void => {
  if (seekFirstPlace()) return;
  const box = document.getElementById(VENUE_SEARCH_INPUT_ID);
  if (box) seekField(box);
};
