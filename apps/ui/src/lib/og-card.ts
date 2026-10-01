import { localizedName, type Locale } from '@founders-coffee/i18n';

import { eventWhen } from './event-when';
import { textLine, type CardNode } from './og-line';

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
        textLine('Founders Coffee', 34, isRtl, {
          fontWeight: 700,
          color: BRAND,
          letterSpacing: 1,
        }),
        textLine(title, titleSize(title), isRtl, {
          fontWeight: 700,
          lineHeight: 1.25,
        }),
        {
          type: 'div',
          props: {
            style: { display: 'flex', flexDirection: 'column', gap: 10 },
            children: [
              textLine(meta, 36, isRtl, { fontWeight: 400, color: MUTED }),
              ...(host
                ? [textLine(host, 30, isRtl, { fontWeight: 400, color: FAINT })]
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
  readonly city: {
    readonly name: string;
    readonly nameAr: string | null;
    readonly nameFr: string | null;
  };
  readonly hostName: string;
};

/** What the card says, in the reader's language, with the date as {@link eventWhen} gives it. */
export const eventCardText = ({
  locale,
  title,
  startsAt,
  timezone,
  city,
  hostName,
}: CardFacts): CardText => {
  const { day, clock } = eventWhen(startsAt, timezone, locale);
  const place = localizedName(city, locale);
  return {
    locale,
    title,
    meta: `${day} · ${clock} · ${place}`,
    host: hostName,
  };
};
