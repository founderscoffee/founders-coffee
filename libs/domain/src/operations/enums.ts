import { z } from 'zod';

export const CLOSEOUT_OUTCOMES = ['held', 'did_not_happen'] as const;
export const ATTENDANCE_OUTCOMES = ['attended', 'no_show'] as const;
export const FEEDBACK_RATINGS = ['valuable', 'okay', 'not_valuable'] as const;
export const HOST_TRUST_STATUSES = [
  'unreviewed',
  'verified',
  'restricted',
] as const;

export const HOST_FRICTIONS = [
  'venue',
  'scheduling',
  'promotion',
  'attendance',
  'format',
  'safety',
  'other_structured',
] as const;

export const OPERATION_REASONS = [
  'host_request',
  'member_dispute',
  'data_entry_error',
  'safety',
  'policy',
  'delivery_recovery',
] as const;

export const REVIEW_BOTTLENECKS = [
  'host_supply',
  'calendar_consistency',
  'venue_readiness',
  'discovery',
  'rsvp_conversion',
  'attendance',
  'event_quality',
  'return_behavior',
  'product_reliability',
] as const;

export const AUDIT_TARGETS = [
  'event',
  'user',
  'closeout',
  'attendance',
  'feedback',
  'host_trust',
  'operations_review',
] as const;

export const AUDIT_ACTIONS = [
  'closeout_submitted',
  'closeout_corrected',
  'attendance_recorded',
  'attendance_corrected',
  'feedback_submitted',
  'feedback_updated',
  'host_trust_updated',
  'event_moderated',
  'user_moderated',
  'review_recorded',
  'ends_at_backfilled',
] as const;

export const closeoutOutcomeSchema = z.enum(CLOSEOUT_OUTCOMES);
export const attendanceOutcomeSchema = z.enum(ATTENDANCE_OUTCOMES);
export const feedbackRatingSchema = z.enum(FEEDBACK_RATINGS);
export const hostTrustStatusSchema = z.enum(HOST_TRUST_STATUSES);
export const hostFrictionSchema = z.enum(HOST_FRICTIONS);
export const operationReasonSchema = z.enum(OPERATION_REASONS);
export const reviewBottleneckSchema = z.enum(REVIEW_BOTTLENECKS);
export const auditTargetSchema = z.enum(AUDIT_TARGETS);
export const auditActionSchema = z.enum(AUDIT_ACTIONS);

/**
 * The friction a host reports, as a set rather than a sentence.
 *
 * Bounded and de-duplicated because these values are counted across markets and months: free text
 * cannot be, and a list that admits the same value twice inflates whatever counts it. §5.8 is
 * explicit that the closeout collects structured categories and not an operational diary — the
 * place for prose is the weekly review, which a human writes and nothing aggregates.
 *
 * `other_structured` is deliberately a category and not an escape hatch for text. §5.22 requires a
 * bounded private note in D1 when it is used, and that note never reaches Analytics.
 */
export const hostFrictionListSchema = z
  .array(hostFrictionSchema)
  .max(HOST_FRICTIONS.length)
  .transform((values) => [...new Set(values)])
  .pipe(z.array(hostFrictionSchema));

export type CloseoutOutcome = z.infer<typeof closeoutOutcomeSchema>;
export type AttendanceOutcome = z.infer<typeof attendanceOutcomeSchema>;
export type FeedbackRating = z.infer<typeof feedbackRatingSchema>;
export type HostTrustStatus = z.infer<typeof hostTrustStatusSchema>;
export type HostFriction = z.infer<typeof hostFrictionSchema>;
export type OperationReason = z.infer<typeof operationReasonSchema>;
export type ReviewBottleneck = z.infer<typeof reviewBottleneckSchema>;
export type AuditTarget = z.infer<typeof auditTargetSchema>;
export type AuditAction = z.infer<typeof auditActionSchema>;
