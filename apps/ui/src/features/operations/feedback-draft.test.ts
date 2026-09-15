import { describe, expect, it } from 'vitest';

import {
  canSubmitFeedback,
  toFeedbackRequest,
  type FeedbackDraft,
} from './feedback-draft';

const complete: FeedbackDraft = {
  rating: 'valuable',
  wouldReturn: true,
  comment: '',
  commentLanguage: null,
};

describe('feedback draft', () => {
  it('requires the two structured answers and authored language for comments', () => {
    expect(canSubmitFeedback(complete)).toBe(true);
    expect(canSubmitFeedback({ ...complete, rating: null })).toBe(false);
    expect(canSubmitFeedback({ ...complete, wouldReturn: null })).toBe(false);
    expect(
      canSubmitFeedback({
        ...complete,
        comment: 'Great',
        commentLanguage: null,
      }),
    ).toBe(false);
  });

  it('keeps optional comments out of the request when empty', () => {
    expect(toFeedbackRequest('evt_1', complete)).toEqual({
      feedback: {
        eventId: 'evt_1',
        rating: 'valuable',
        wouldReturn: true,
        comment: undefined,
      },
    });
  });
});
