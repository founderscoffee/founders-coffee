import {
  closeout_did_not_happen,
  closeout_friction,
  closeout_held,
  no,
  closeout_outcome,
  closeout_private_note,
  closeout_review,
  closeout_review_registered,
  closeout_review_total,
  closeout_roster,
  closeout_walk_ins,
  closeout_would_host_again,
  yes,
  type Locale,
} from '@founders-coffee/i18n';

import { frictionLabel } from '../friction';
import {
  FRICTIONS,
  WALK_IN_MAX,
  totalsFor,
  type CloseoutDraft,
  type Mark,
} from '../draft';
import { CloseoutRoster } from './CloseoutRoster';
import type { CloseoutView } from '../api';

export const CloseoutForm = ({
  locale,
  view,
  draft,
  onChange,
}: {
  locale: Locale;
  view: CloseoutView;
  draft: CloseoutDraft;
  onChange: (changes: Partial<CloseoutDraft>) => void;
}) => {
  const totals = totalsFor(draft);
  const held = draft.outcome === 'held';

  const mark = (userId: string, outcome: Mark) =>
    onChange({ marks: { ...draft.marks, [userId]: outcome } });

  return (
    <div className="space-y-6">
      <fieldset className="rounded-box border border-base-300 p-5">
        <legend className="px-1 font-display text-h4">
          {closeout_outcome({}, { locale })}
        </legend>
        {(['held', 'did_not_happen'] as const).map((outcome) => (
          <label className="mt-2 flex items-center gap-3" key={outcome}>
            <input
              checked={draft.outcome === outcome}
              name="closeout-outcome"
              onChange={() => onChange({ outcome })}
              type="radio"
            />
            <span>
              {outcome === 'held'
                ? closeout_held({}, { locale })
                : closeout_did_not_happen({}, { locale })}
            </span>
          </label>
        ))}
      </fieldset>

      {held && (
        <>
          <fieldset className="rounded-box border border-base-300 p-5">
            <legend className="px-1 font-display text-h4">
              {closeout_roster({}, { locale })}
            </legend>
            <CloseoutRoster
              locale={locale}
              marks={draft.marks}
              onMark={mark}
              roster={view.roster}
            />

            <label className="mt-4 block" htmlFor="walk-ins">
              {closeout_walk_ins({}, { locale })}
            </label>
            <input
              className="mt-1 w-24 rounded-box border border-base-300 p-2"
              id="walk-ins"
              inputMode="numeric"
              max={WALK_IN_MAX}
              min={0}
              onChange={(event) =>
                onChange({
                  walkInCount: Math.max(0, Number(event.target.value) || 0),
                })
              }
              type="number"
              value={draft.walkInCount}
            />
          </fieldset>

          <section className="rounded-box border border-base-300 p-5">
            <h2 className="font-display text-h4">
              {closeout_review({}, { locale })}
            </h2>
            <p className="mt-2 text-body-sm">
              {closeout_review_registered(
                { count: totals.registered },
                { locale },
              )}
            </p>
            <p className="text-body-sm">
              {closeout_review_total({ count: totals.total }, { locale })}
            </p>
          </section>
        </>
      )}

      <fieldset className="rounded-box border border-base-300 p-5">
        <legend className="px-1 font-display text-h4">
          {closeout_would_host_again({}, { locale })}
        </legend>
        <div className="mt-2 flex gap-4">
          {[true, false].map((answer) => (
            <label className="flex items-center gap-2" key={String(answer)}>
              <input
                checked={draft.wouldHostAgain === answer}
                name="would-host-again"
                onChange={() => onChange({ wouldHostAgain: answer })}
                type="radio"
              />
              <span>{answer ? yes({}, { locale }) : no({}, { locale })}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="rounded-box border border-base-300 p-5">
        <legend className="px-1 font-display text-h4">
          {closeout_friction({}, { locale })}
        </legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {FRICTIONS.map((friction) => (
            <label className="flex items-center gap-2" key={friction}>
              <input
                checked={draft.friction.includes(friction)}
                onChange={(event) =>
                  onChange({
                    friction: event.target.checked
                      ? [...draft.friction, friction]
                      : draft.friction.filter((item) => item !== friction),
                  })
                }
                type="checkbox"
              />
              <span className="text-body-sm">
                {frictionLabel(friction, locale)}
              </span>
            </label>
          ))}
        </div>

        {draft.friction.includes('other_structured') && (
          <>
            <label className="mt-4 block" htmlFor="private-note">
              {closeout_private_note({}, { locale })}
            </label>
            <textarea
              className="mt-1 w-full rounded-box border border-base-300 p-2"
              id="private-note"
              maxLength={500}
              onChange={(event) =>
                onChange({ privateNote: event.target.value })
              }
              rows={3}
              value={draft.privateNote}
            />
          </>
        )}
      </fieldset>
    </div>
  );
};
