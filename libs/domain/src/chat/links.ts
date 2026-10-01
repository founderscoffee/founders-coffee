export type ChatBodySegment =
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'link'; readonly text: string; readonly href: string };

const ADDRESS = /https?:\/\/[^\s<>"]+/giu;
const CLOSING_PAIRS: Readonly<Record<string, string>> = {
  ')': '(',
  ']': '[',
  '}': '{',
};
const SENTENCE_PUNCTUATION = new Set([
  '.',
  ',',
  ';',
  ':',
  '!',
  '?',
  "'",
  '"',
  '«',
  '»',
  '…',
  '،',
  '؛',
  '؟',
]);

const count = (text: string, character: string): number =>
  text.split(character).length - 1;

/**
 * An address without the punctuation that ends the sentence around it.
 *
 * "See https://example.com." links the address, not the full stop, in either script: «زوروا
 * https://example.com،» ends with an Arabic comma. A closing bracket stays when the address opened
 * one, as in https://en.wikipedia.org/wiki/Cafe_(disambiguation), and goes when the sentence did.
 */
const trimAddress = (candidate: string): string => {
  let address = candidate;
  while (address.length > 0) {
    const last = address.slice(-1);
    const opening = CLOSING_PAIRS[last];
    const isUnbalanced =
      opening !== undefined && count(address, last) > count(address, opening);
    if (!SENTENCE_PUNCTUATION.has(last) && !isUnbalanced) break;
    address = address.slice(0, -1);
  }
  return address;
};

/**
 * The address a link opens, or null when the text does not parse as a URL.
 *
 * {@link ADDRESS} only matches text that starts `http://` or `https://`, so what parses is a web
 * address, and the parser refuses one with no host.
 */
const linkTarget = (address: string): string | null => {
  try {
    return new URL(address).href;
  } catch {
    return null;
  }
};

/**
 * A message body cut into its text and the `http` and `https` addresses in it, in order.
 *
 * The segments put back together are the body exactly, so a screen renders each one as it is and
 * links only the addresses. `href` is the parsed address, so what a link opens is what the URL
 * parser read rather than what the text claims, and an address that does not parse stays text.
 */
export const chatBodySegments = (body: string): ChatBodySegment[] => {
  const segments: ChatBodySegment[] = [];
  let cursor = 0;
  for (const match of body.matchAll(ADDRESS)) {
    const text = trimAddress(match[0]);
    const href = linkTarget(text);
    if (href === null) continue;
    if (match.index > cursor) {
      segments.push({ kind: 'text', text: body.slice(cursor, match.index) });
    }
    segments.push({ kind: 'link', text, href });
    cursor = match.index + text.length;
  }
  if (cursor < body.length) {
    segments.push({ kind: 'text', text: body.slice(cursor) });
  }
  return segments;
};
