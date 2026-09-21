import {
  getCloseoutView,
  getMyCloseoutStates,
  submitCloseout,
  getFeedbackTally,
  getFeedbackView,
  submitFeedback,
  type CloseoutStateView,
  type CloseoutView,
  type SubmitCloseoutRequest,
  type FeedbackTallyView,
  type FeedbackView,
  type SubmitFeedbackRequest,
} from '@founders-coffee/server-fns';

export const operationsApi = {
  getCloseoutView: (eventId: string): Promise<CloseoutView> =>
    getCloseoutView({ data: { eventId } }),
  getMyCloseoutStates: (
    eventIds: readonly string[],
  ): Promise<readonly CloseoutStateView[]> =>
    getMyCloseoutStates({ data: { eventIds: [...eventIds] } }),
  submitCloseout: (
    input: SubmitCloseoutRequest,
  ): Promise<{ refusedMarks: readonly string[] }> =>
    submitCloseout({ data: input }),
  getFeedbackView: (eventId: string): Promise<FeedbackView> =>
    getFeedbackView({ data: { eventId } }),
  getFeedbackTally: (eventId: string): Promise<FeedbackTallyView> =>
    getFeedbackTally({ data: { eventId } }),
  submitFeedback: (input: SubmitFeedbackRequest): Promise<EventFeedbackRow> =>
    submitFeedback({ data: input }),
};

export type {
  CloseoutStateView,
  CloseoutView,
  FeedbackTallyView,
  FeedbackView,
  SubmitCloseoutRequest,
  SubmitFeedbackRequest,
};
type EventFeedbackRow = NonNullable<FeedbackView['feedback']>;
