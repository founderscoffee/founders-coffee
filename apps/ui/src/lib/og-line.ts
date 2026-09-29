export type CardNode = {
  readonly type: string;
  readonly props: Record<string, unknown>;
};

const LATIN_LETTER = /[A-Za-z\u00C0-\u024F]/;
const RTL_LETTER = /[\u0590-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFEFC]/;

/**
 * Which way a line reads, from the first letter that answers for itself.
 *
 * A card's language does not decide this. An Arabic meetup shared to a French reader puts its
 * Arabic title on a French card, and that title still reads from the right; only where the line
 * sits on the card follows the language. This is the rule a browser applies for `dir="auto"`.
 */
const startsRtl = (text: string): boolean => {
  const rtl = text.search(RTL_LETTER);
  if (rtl < 0) return false;
  const latin = text.search(LATIN_LETTER);
  return latin < 0 || rtl < latin;
};

const reverseRuns = (
  words: readonly string[],
  inRun: (word: string) => boolean,
): string[] => {
  const ordered: string[] = [];
  let run: string[] = [];
  for (const word of words) {
    if (inRun(word)) {
      run.push(word);
      continue;
    }
    ordered.push(...run.reverse(), word);
    run = [];
  }
  ordered.push(...run.reverse());
  return ordered;
};

/**
 * Put the words of one line in the order they are to be drawn in.
 *
 * Satori has no bidirectional algorithm. It shapes each Arabic word correctly — the letters join,
 * and they run right to left within the word — and then places the words themselves in the order
 * they were written, so every Arabic line comes out backwards. Setting `direction` on the line or
 * on the card changes nothing.
 *
 * What flips a line here is `flexDirection`, which satori does honour, so the words stay in the
 * order they were written and only the runs that read the other way are turned around: `لقاء مع
 * Founders Coffee` laid out right to left needs its two Latin words the other way about, or they
 * are drawn as `Coffee Founders`. That matters for the strip along the top and for a host whose
 * name is written in Latin letters, which on an Arabic card is ordinary here. A left-to-right
 * line gets the mirror treatment, which is what an Arabic title on a French card needs.
 *
 * Leaving the words in written order is also what makes a title that wraps read properly: the
 * first words have to land on the first line, and they only do if the box they are in is the
 * first one.
 *
 * Digits and separators belong to neither side and are left where they fall, which is right for
 * every line this card draws: `الجمعة، 25 سبتمبر` wants its `25` between the two words either
 * way, and a time stays whole because it is one word to a split on spaces. The real algorithm
 * would also hand a separator standing between two Latin words to those words — `Ahmed & Sons` on
 * a right-to-left line would come out as `Sons & Ahmed` here. Nothing the card draws reads that
 * way today, and the alternative is the whole algorithm.
 */
const visualOrder = (words: readonly string[], isRtl: boolean): string[] =>
  isRtl
    ? reverseRuns(words, (word) => LATIN_LETTER.test(word))
    : reverseRuns(words, (word) => RTL_LETTER.test(word));

const MIRRORED: Readonly<Record<string, string>> = {
  '(': ')',
  ')': '(',
  '[': ']',
  ']': '[',
  '{': '}',
  '}': '{',
  '<': '>',
  '>': '<',
  '«': '»',
  '»': '«',
  '‹': '›',
  '›': '‹',
};

const EDGES = /^(\p{P}*)(.*?)(\p{P}*)$/su;

const box = (
  children: string | readonly CardNode[],
  key: number,
  style: Record<string, unknown> = {},
): CardNode => ({
  type: 'div',
  props: { key, style: { display: 'flex', ...style }, children },
});

/**
 * One word of a right-to-left line, with the punctuation at either end drawn on the side it ends.
 *
 * Satori runs an Arabic word right to left only as far as one font draws it. A mark the Arabic face
 * does not have, such as `:` or `.`, is drawn by the Latin one, and the two pieces are then set
 * left to right, so `ونقاش:` came out with its colon on the right, where the word begins (#113).
 * Each mark at either end becomes a box of its own, and the word lays its boxes out right to left
 * in written order. A bracket or a guillemet is drawn as its mirror image, the glyph the
 * bidirectional algorithm would substitute, so that it faces the words it encloses.
 *
 * Only a right-to-left line needs this. On a left-to-right line an Arabic word's closing mark
 * belongs after it in left-to-right order, which is where satori already puts it. A mark at the
 * edge of a Latin word on a right-to-left line stays with that word, which the real algorithm
 * would move to the far side of the Latin run: `Coffee:` before an Arabic word is drawn with its
 * colon against `Coffee` rather than across the run.
 */
const rtlWord = (word: string, key: number): CardNode => {
  const [, lead = '', core = '', trail = ''] = EDGES.exec(word) ?? [];
  if (!lead && !trail) return box(word, key);
  const marks = (edge: string) =>
    [...edge].map((mark) => MIRRORED[mark] ?? mark);
  const pieces = [...marks(lead), core, ...marks(trail)];
  return box(
    pieces.map((piece, index) => box(piece, index)),
    key,
    { flexDirection: 'row-reverse' },
  );
};

/**
 * One text line, with every word its own box.
 *
 * Satori drops the space between two words whenever the run it is laying out changes direction,
 * so an Arabic title came out as `للمؤسسينقهوة` and a date line lost the space on either side of
 * its digits. Words in their own boxes with a `gap` never depend on satori measuring a space at
 * all, and Arabic joins within a word rather than across one, so splitting on spaces cannot break
 * a ligature. Placing the boxes by hand is also what makes `visualOrder` above possible.
 *
 * Which way the words run is the line's own business; which margin they hang off is the card's.
 * A line that reads the same way as the card starts at the card's own margin, and one that reads
 * the other way is pushed across to it — which is how an Arabic title sits against the left edge
 * of a French card while still reading from the right.
 */
export const textLine = (
  text: string,
  size: number,
  cardIsRtl: boolean,
  style: Record<string, unknown>,
): CardNode => {
  const isRtl = startsRtl(text);
  return {
    type: 'div',
    props: {
      style: {
        display: 'flex',
        flexDirection: isRtl ? 'row-reverse' : 'row',
        flexWrap: 'wrap',
        justifyContent: isRtl === cardIsRtl ? 'flex-start' : 'flex-end',
        gap: size * 0.26,
        fontSize: size,
        ...style,
      },
      children: visualOrder(text.split(/\s+/).filter(Boolean), isRtl).map(
        (word, index) =>
          isRtl && RTL_LETTER.test(word)
            ? rtlWord(word, index)
            : box(word, index),
      ),
    },
  };
};
