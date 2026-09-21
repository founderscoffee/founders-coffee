import { MessageSquare } from 'lucide-react';

import {
  tally_below_floor,
  tally_not_valuable,
  tally_okay,
  tally_responses,
  tally_return,
  tally_title,
  tally_valuable,
  type Locale,
} from '@founders-coffee/i18n';

import type { FeedbackTallyView } from '../api';

export const FeedbackTally = ({
  locale,
  tally,
}: {
  locale: Locale;
  tally: FeedbackTallyView;
}) => (
  <section className="space-y-2">
    <h2 className="text-body-sm font-medium">{tally_title({}, { locale })}</h2>
    {tally.state === 'below_floor' ? (
      <div className="alert alert-info alert-soft">
        <MessageSquare className="size-4 shrink-0" aria-hidden="true" />
        <span>{tally_below_floor({}, { locale })}</span>
      </div>
    ) : (
      <ul className="space-y-1 text-body-sm text-neutral">
        <li>{tally_responses({ count: tally.responses }, { locale })}</li>
        <li>{tally_valuable({ count: tally.valuable }, { locale })}</li>
        <li>{tally_okay({ count: tally.okay }, { locale })}</li>
        <li>{tally_not_valuable({ count: tally.notValuable }, { locale })}</li>
        <li>{tally_return({ count: tally.wouldReturn }, { locale })}</li>
      </ul>
    )}
  </section>
);
