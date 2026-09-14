import {
  getCloseoutView,
  getMyCloseoutStates,
  submitCloseout,
  type CloseoutStateView,
  type CloseoutView,
  type SubmitCloseoutRequest,
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
};

export type { CloseoutStateView, CloseoutView };
