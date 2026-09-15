import { describe, expect, it } from 'vitest';

import {
  ATTENDANCE_RECORDING_OUTCOMES,
  CLOSEOUT_CORRECTION_OUTCOMES,
  CLOSEOUT_PROMPT_OUTCOMES,
  CLOSEOUT_SUBMISSION_OUTCOMES,
  FEEDBACK_ELIGIBILITY_STATUSES,
  FEEDBACK_SUBMISSION_OUTCOMES,
  NOTIFICATION_DISPATCH_KINDS,
  OPERATIONS_ERROR_CODES,
  RSVP_CREATION_OUTCOMES,
  WAITLIST_JOIN_OUTCOMES,
  attendanceRecordingOutcomeSchema,
  closeoutCorrectionOutcomeSchema,
  closeoutPromptOutcomeSchema,
  closeoutSubmissionOutcomeSchema,
  feedbackEligibilityStatusSchema,
  feedbackSubmissionOutcomeSchema,
  isOperationsErrorCode,
  notificationDispatchKindSchema,
  operationsErrorCodeSchema,
  rsvpCreationOutcomeSchema,
  waitlistJoinOutcomeSchema,
} from './outcomes.js';

const contracts = [
  [RSVP_CREATION_OUTCOMES, rsvpCreationOutcomeSchema],
  [WAITLIST_JOIN_OUTCOMES, waitlistJoinOutcomeSchema],
  [ATTENDANCE_RECORDING_OUTCOMES, attendanceRecordingOutcomeSchema],
  [CLOSEOUT_SUBMISSION_OUTCOMES, closeoutSubmissionOutcomeSchema],
  [CLOSEOUT_CORRECTION_OUTCOMES, closeoutCorrectionOutcomeSchema],
  [FEEDBACK_SUBMISSION_OUTCOMES, feedbackSubmissionOutcomeSchema],
  [FEEDBACK_ELIGIBILITY_STATUSES, feedbackEligibilityStatusSchema],
  [CLOSEOUT_PROMPT_OUTCOMES, closeoutPromptOutcomeSchema],
  [NOTIFICATION_DISPATCH_KINDS, notificationDispatchKindSchema],
  [OPERATIONS_ERROR_CODES, operationsErrorCodeSchema],
] as const;

describe('outcome contracts', () => {
  it.each(contracts)('accepts every value in %j', (values, schema) => {
    for (const value of values)
      expect(schema.safeParse(value).success).toBe(true);
  });

  it.each(contracts)('rejects unknown values in %j', (_values, schema) => {
    expect(schema.safeParse('unknown_outcome').success).toBe(false);
  });
});

describe('operations error codes', () => {
  it('guards strings at the logging and mapping boundary', () => {
    expect(isOperationsErrorCode('event_not_ended')).toBe(true);
    expect(isOperationsErrorCode('not_eligible')).toBe(false);
  });
});
