import {
  feedback_comment,
  feedback_comment_language,
  optional,
  feedback_not_valuable,
  feedback_okay,
  feedback_rating,
  feedback_return,
  no,
  yes,
  feedback_valuable,
  LOCALES,
  type Locale,
} from '@founders-coffee/i18n';

import type { FeedbackDraft, FeedbackRating } from '../feedback-draft';

const ratings: readonly FeedbackRating[] = ['valuable', 'okay', 'not_valuable'];
export const FeedbackForm = ({
  locale,
  draft,
  onChange,
}: {
  locale: Locale;
  draft: FeedbackDraft;
  onChange: (changes: Partial<FeedbackDraft>) => void;
}) => (
  <div className="space-y-6">
    <fieldset>
      <legend className="mb-3 font-display text-h4">
        {feedback_rating({}, { locale })}
      </legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {ratings.map((rating) => (
          <label
            className={`btn justify-start ${
              draft.rating === rating ? 'btn-primary' : 'btn-outline'
            }`}
            key={rating}
          >
            <input
              className="sr-only"
              type="radio"
              name="feedback-rating"
              checked={draft.rating === rating}
              onChange={() => onChange({ rating })}
            />
            {rating === 'valuable'
              ? feedback_valuable({}, { locale })
              : rating === 'okay'
                ? feedback_okay({}, { locale })
                : feedback_not_valuable({}, { locale })}
          </label>
        ))}
      </div>
    </fieldset>
    <fieldset>
      <legend className="mb-3 font-display text-h4">
        {feedback_return({}, { locale })}
      </legend>
      <div className="flex gap-4">
        {([true, false] as const).map((answer) => (
          <label className="flex items-center gap-2" key={String(answer)}>
            <input
              type="radio"
              name="feedback-return"
              checked={draft.wouldReturn === answer}
              onChange={() => onChange({ wouldReturn: answer })}
            />
            {answer
              ? yes({}, { locale })
              : no({}, { locale })}
          </label>
        ))}
      </div>
    </fieldset>
    <label className="block" htmlFor="feedback-comment">
      <span className="font-display text-h4">
        {feedback_comment({}, { locale })}
      </span>
      <span className="ms-2 text-body-sm text-neutral">
        {optional({}, { locale })}
      </span>
      <textarea
        aria-label={feedback_comment({}, { locale })}
        id="feedback-comment"
        className="textarea textarea-bordered mt-2 min-h-28 w-full"
        maxLength={600}
        value={draft.comment}
        onChange={(event) => onChange({ comment: event.target.value })}
      />
    </label>
    {draft.comment.trim() && (
      <label className="block" htmlFor="feedback-comment-language">
        <span className="font-display text-h4">
          {feedback_comment_language({}, { locale })}
        </span>
        <select
          id="feedback-comment-language"
          className="select select-bordered mt-2 w-full"
          value={draft.commentLanguage ?? ''}
          onChange={(event) =>
            onChange({
              commentLanguage: event.target
                .value as FeedbackDraft['commentLanguage'],
            })
          }
          required
        >
          <option value="" disabled>
            {locale.toUpperCase()}
          </option>
          {LOCALES.map((item) => (
            <option key={item} value={item}>
              {item.toUpperCase()}
            </option>
          ))}
        </select>
      </label>
    )}
  </div>
);
