import {
  closeout_already_done,
  closeout_done,
  closeout_private_note,
  closeout_review_registered,
  closeout_review_total,
  closeout_walk_ins,
  tally_not_valuable,
  tally_okay,
  tally_responses,
  tally_return,
  tally_valuable,
} from '@founders-coffee/i18n';

const EN = { locale: 'en' } as const;

type Counted = (inputs: { count: number }, options: typeof EN) => string;

/**
 * The words in front of the number in a tally line: `Very useful` out of `Very useful: {count}`.
 *
 * A suppressed summary must not print the counts it is holding back, and checking that needs the
 * label with no number attached to it, whatever the number would have been.
 */
const label = (line: Counted) => line({ count: 0 }, EN).split(':')[0] ?? '';

export const copy = {
  alreadyDone: closeout_already_done({}, EN),
  done: closeout_done({}, EN),
  privateNote: closeout_private_note({}, EN),
  walkIns: closeout_walk_ins({}, EN),
  registered: (count: number) => closeout_review_registered({ count }, EN),
  total: (count: number) => closeout_review_total({ count }, EN),
  responses: (count: number) => tally_responses({ count }, EN),
  valuable: (count: number) => tally_valuable({ count }, EN),
  okay: (count: number) => tally_okay({ count }, EN),
  notValuable: (count: number) => tally_not_valuable({ count }, EN),
  wouldReturn: (count: number) => tally_return({ count }, EN),
  ratingLabels: [tally_valuable, tally_okay, tally_not_valuable].map(label),
};
