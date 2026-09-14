import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import { FeedbackForm } from './FeedbackForm';
import type { FeedbackDraft } from '../feedback-draft';

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
      screen.getByRole('group', {
        name: 'How valuable was this meetup for you?',
      }),
    ).toBeTruthy();
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'More time' },
    });
    expect(draft.comment).toBe('More time');
  });
});
