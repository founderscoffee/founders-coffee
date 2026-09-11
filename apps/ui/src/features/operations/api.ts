import {
  getCloseoutView,
  submitCloseout,
  type CloseoutView,
  type SubmitCloseoutRequest,
} from '@founders-coffee/server-fns';

export const operationsApi = {
  getCloseoutView: (eventId: string): Promise<CloseoutView> =>
    getCloseoutView({ data: { eventId } }),
  submitCloseout: (
    input: SubmitCloseoutRequest,
  ): Promise<{ refusedMarks: readonly string[] }> =>
    submitCloseout({ data: input }),
};

export type { CloseoutView };
