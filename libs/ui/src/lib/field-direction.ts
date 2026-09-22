const LEFT_TO_RIGHT_TYPES = new Set(['email', 'url', 'tel']);
const LEFT_TO_RIGHT_MODES = new Set([
  'email',
  'url',
  'tel',
  'numeric',
  'decimal',
]);

/**
 * Which way the contents of a field are written, when the caller has not said.
 *
 * An email address, a URL, a phone number and a digit code read left to right wherever in the world
 * they are typed. On an Arabic page they inherit `rtl` from the document, and the usual repair is a
 * `text-align` on that one field: it moves the text and leaves the direction alone, so the caret
 * still starts on the wrong side and a value mixing Latin with Arabic still reorders itself. The
 * login address had exactly that, measured as `direction: rtl` under `text-align: left`.
 *
 * Prose is the opposite case and is left to follow the page. A name, a title or a description is
 * written in whatever language the reader is writing in, and forcing it left to right would break
 * the far more common field to fix the rarer one.
 *
 * Answering from the type rather than at each call site is what keeps this from drifting: the next
 * email field added anywhere gets it without the author knowing this was ever a problem.
 */
export const defaultFieldDirection = (
  type: string,
  inputMode: string | undefined,
): 'ltr' | undefined =>
  LEFT_TO_RIGHT_TYPES.has(type) ||
  (inputMode !== undefined && LEFT_TO_RIGHT_MODES.has(inputMode))
    ? 'ltr'
    : undefined;
