import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  feedback_okay,
  feedback_rating,
  feedback_valuable,
} from '@founders-coffee/i18n';

import { visibleOptionMarkup } from '../../../lib/visible-selection';
import { FeedbackForm } from './FeedbackForm';
import type { FeedbackDraft, FeedbackRating } from '../feedback-draft';

const inEnglish = (
  message: (inputs: Record<string, never>, options: { locale: 'en' }) => string,
) => message({}, { locale: 'en' });

const initial: FeedbackDraft = {
  rating: null,
  wouldReturn: null,
  comment: '',
  commentLanguage: null,
};

afterEach(cleanup);

describe('FeedbackForm', () => {
  it('exposes accessible structured controls and asks for language with a comment', () => {
    let draft = initial;
    render(
      <FeedbackForm
        locale="en"
        draft={draft}
        onChange={(changes) => {
          draft = { ...draft, ...changes };
        }}
      />,
    );
    expect(
      screen.getByRole('group', { name: inEnglish(feedback_rating) }),
      'the ratings are a fieldset, and a fieldset that is not labelled by the question leaves three bare radios with nothing saying what they answer',
    ).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'More time' },
    });
    expect(draft.comment).toBe('More time');
  });
});

const markupWith = (rating: FeedbackRating, option: string): string => {
  const { container } = render(
    <FeedbackForm
      locale="en"
      draft={{ ...initial, rating }}
      onChange={() => undefined}
    />,
  );
  const markup = visibleOptionMarkup(container, option);
  cleanup();
  return markup;
};

describe('the rating a reader has chosen', () => {
  it('looks different from the ones they have not', () => {
    expect(
      markupWith('valuable', inEnglish(feedback_valuable)),
      'the chosen option renders identically to the same option unchosen, so nothing on screen says which one was picked',
    ).not.toEqual(markupWith('okay', inEnglish(feedback_valuable)));
  });

  it('marks the one that is chosen, not merely a different one each time', () => {
    const chosen = markupWith('okay', inEnglish(feedback_okay));
    expect(chosen).not.toEqual(
      markupWith('valuable', inEnglish(feedback_okay)),
    );
    expect(chosen).not.toEqual(
      markupWith('not_valuable', inEnglish(feedback_okay)),
    );
  });
});
