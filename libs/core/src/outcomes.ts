import { z } from 'zod';

export const RSVP_CREATION_OUTCOMES = [
  'created',
  'event_missing',
  'already_rsvpd',
  'rsvp_closed',
] as const;
export type RsvpCreationOutcome = (typeof RSVP_CREATION_OUTCOMES)[number];
export const rsvpCreationOutcomeSchema = z.enum(RSVP_CREATION_OUTCOMES);

export const WAITLIST_JOIN_OUTCOMES = ['joined', 'already_waitlisted'] as const;
export type WaitlistJoinOutcome = (typeof WAITLIST_JOIN_OUTCOMES)[number];
export const waitlistJoinOutcomeSchema = z.enum(WAITLIST_JOIN_OUTCOMES);

export const ATTENDANCE_RECORDING_OUTCOMES = [
  'recorded',
  'not_host',
  'not_eligible',
  'not_ended',
  'event_cancelled',
] as const;
export type AttendanceRecordingOutcome =
  (typeof ATTENDANCE_RECORDING_OUTCOMES)[number];
export const attendanceRecordingOutcomeSchema = z.enum(
  ATTENDANCE_RECORDING_OUTCOMES,
);

export const CLOSEOUT_SUBMISSION_OUTCOMES = [
  'submitted',
  'already_closed',
  'not_host',
  'not_ended',
  'no_end_time',
  'event_cancelled',
] as const;
export type CloseoutSubmissionOutcome =
  (typeof CLOSEOUT_SUBMISSION_OUTCOMES)[number];
export const closeoutSubmissionOutcomeSchema = z.enum(
  CLOSEOUT_SUBMISSION_OUTCOMES,
);

export const CLOSEOUT_CORRECTION_OUTCOMES = [
  'corrected',
  'stale_version',
  'not_closed',
] as const;
export type CloseoutCorrectionOutcome =
  (typeof CLOSEOUT_CORRECTION_OUTCOMES)[number];
export const closeoutCorrectionOutcomeSchema = z.enum(
  CLOSEOUT_CORRECTION_OUTCOMES,
);

export const FEEDBACK_SUBMISSION_OUTCOMES = [
  'saved',
  'not_attended',
  'window_closed',
  'not_invited',
] as const;
export type FeedbackSubmissionOutcome =
  (typeof FEEDBACK_SUBMISSION_OUTCOMES)[number];
export const feedbackSubmissionOutcomeSchema = z.enum(
  FEEDBACK_SUBMISSION_OUTCOMES,
);

export const FEEDBACK_ELIGIBILITY_STATUSES = [
  'ready',
  'not_attended',
  'not_invited',
  'window_closed',
] as const;
export type FeedbackEligibilityStatus =
  (typeof FEEDBACK_ELIGIBILITY_STATUSES)[number];
export const feedbackEligibilityStatusSchema = z.enum(
  FEEDBACK_ELIGIBILITY_STATUSES,
);

export const CLOSEOUT_PROMPT_OUTCOMES = [
  'scheduled',
  'already_scheduled',
  'no_end_time',
  'no_channels',
] as const;
export type CloseoutPromptOutcome = (typeof CLOSEOUT_PROMPT_OUTCOMES)[number];
export const closeoutPromptOutcomeSchema = z.enum(CLOSEOUT_PROMPT_OUTCOMES);

export const NOTIFICATION_DISPATCH_KINDS = ['sent', 'failed'] as const;
export type NotificationDispatchKind =
  (typeof NOTIFICATION_DISPATCH_KINDS)[number];
export const notificationDispatchKindSchema = z.enum(
  NOTIFICATION_DISPATCH_KINDS,
);

export const OPERATIONS_ERROR_CODES = [
  'event_not_ended',
  'event_no_end_time',
  'event_cancelled',
  'not_event_host',
  'attendee_not_eligible',
  'closeout_already_recorded',
  'closeout_not_recorded',
  'closeout_stale_version',
  'feedback_not_attended',
  'feedback_not_invited',
  'feedback_window_closed',
  'operations_disabled',
] as const;
export type OperationsErrorCode = (typeof OPERATIONS_ERROR_CODES)[number];
export const operationsErrorCodeSchema = z.enum(OPERATIONS_ERROR_CODES);

export const isOperationsErrorCode = (
  code: string,
): code is OperationsErrorCode =>
  (OPERATIONS_ERROR_CODES as readonly string[]).includes(code);
