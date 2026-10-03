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
