import { formatDate, localizedName, type Locale } from '@founders-coffee/i18n';

const WIDTH = 1200;
const HEIGHT = 630;
const PAD = 72;

const INK = '#270F00';
const GROUND = '#FFFCF7';
const MUTED = '#5C4A3D';
const FAINT = '#8A7466';
const BRAND = '#8A6A4A';

const TITLE_STEPS = [
  { upTo: 40, size: 76 },
  { upTo: 72, size: 60 },
  { upTo: 100, size: 50 },
];
const TITLE_SIZE_MIN = 44;

export type CardText = {
  readonly locale: Locale;
  readonly title: string;
  readonly meta: string;
  readonly host: string;
};

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
const line = (
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
        (word, index) => ({
          type: 'div',
          props: { key: index, style: { display: 'flex' }, children: word },
        }),
      ),
    },
  };
};

/**
 * How big the title is set, which is a question of how much of it there is.
 *
 * A meetup may be titled in up to 120 characters, and 120 characters at the size a short title is
 * set in fills the card four lines deep and pushes everything else off it. The steps are in
 * characters rather than measured width because the tree is built without a font: they are chosen
 * to keep the longest title a host can write inside three lines, in Arabic, which is the widest
 * of the three languages at a given size.
 */
const titleSize = (title: string): number =>
  TITLE_STEPS.find((step) => title.length <= step.upTo)?.size ?? TITLE_SIZE_MIN;

/**
 * The social card for one meetup, as a tree satori can lay out.
 *
 * Kept free of satori and of the font bytes so that what the card says can be asserted in an
 * ordinary test, without a WebAssembly rasteriser: the part that goes wrong in a card is the text,
 * not the pixels.
 */
export const eventCardTree = ({
  locale,
  title,
  meta,
  host,
}: CardText): CardNode => {
  const isRtl = locale === 'ar';
  return {
    type: 'div',
    props: {
      style: {
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: PAD,
        overflow: 'hidden',
        background: GROUND,
        color: INK,
        fontFamily: 'Tajawal, TajawalLatin',
        borderBottom: `18px solid ${INK}`,
      },
      children: [
        line('Founders Coffee', 34, isRtl, {
          fontWeight: 700,
          color: BRAND,
          letterSpacing: 1,
        }),
        line(title, titleSize(title), isRtl, {
          fontWeight: 700,
          lineHeight: 1.25,
        }),
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column', gap: 10 },
            children: [
              line(meta, 36, isRtl, { fontWeight: 400, color: MUTED }),
              ...(host
                ? [line(host, 30, isRtl, { fontWeight: 400, color: FAINT })]
                : []),
            ],
          },
        },
      ],
    },
  };
};

type CardFacts = {
  readonly locale: Locale;
  readonly title: string;
  readonly startsAt: Date;
  readonly timezone: string;
  readonly city: { readonly name: string; readonly nameAr: string | null };
  readonly hostName: string;
};

/**
 * What the card says, in the reader's language.
 *
 * The date is formatted in the market's timezone rather than the renderer's, for the same reason
 * the event page is: a card generated in UTC would tell half the readers the wrong evening.
 */
export const eventCardText = ({
  locale,
  title,
  startsAt,
  timezone,
  city,
  hostName,
}: CardFacts): CardText => {
  const on = (options: Intl.DateTimeFormatOptions): string =>
    formatDate(startsAt, locale, {
      timeZone: timezone,
      hour12: false,
      ...options,
    });
  const day = on({ weekday: 'long', day: 'numeric', month: 'long' });
  const clock = on({ hour: '2-digit', minute: '2-digit' });
  const place = localizedName(
    { name: city.name, nameAr: city.nameAr, nameFr: null },
    locale,
  );
  return {
    locale,
    title,
    meta: `${day} · ${clock} · ${place}`,
    host: hostName,
  };
};
