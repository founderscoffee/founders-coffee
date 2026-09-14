import type { FeedbackView } from './api';

export type FeedbackRating = 'valuable' | 'okay' | 'not_valuable';

export interface FeedbackDraft {
  readonly rating: FeedbackRating | null;
  readonly wouldReturn: boolean | null;
  readonly comment: string;
  readonly commentLanguage: 'ar' | 'fr' | 'en' | null;
}

export const draftFromFeedback = (view: FeedbackView): FeedbackDraft => ({
  rating: view.feedback?.valueRating ?? null,
  wouldReturn: view.feedback?.wouldReturn ?? null,
  comment: view.feedback?.comment ?? '',
  commentLanguage: view.feedback?.commentLanguage ?? null,
});

export const canSubmitFeedback = (draft: FeedbackDraft): boolean =>
  draft.rating !== null &&
  draft.wouldReturn !== null &&
  (!draft.comment.trim() || draft.commentLanguage !== null);

export const toFeedbackRequest = (eventId: string, draft: FeedbackDraft) => ({
  feedback: {
    eventId,
    rating: draft.rating as FeedbackRating,
    wouldReturn: draft.wouldReturn as boolean,
    comment: draft.comment.trim() || undefined,
    ...(draft.comment.trim() && draft.commentLanguage
      ? { commentLanguage: draft.commentLanguage }
      : {}),
  },
});
