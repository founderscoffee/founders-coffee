import { z } from 'zod';

import {
  ATTENDANCE_OUTCOMES,
  AUDIT_ACTIONS,
  AUDIT_TARGETS,
  CLOSEOUT_OUTCOMES,
  FEEDBACK_RATINGS,
  HOST_FRICTIONS,
  HOST_TRUST_STATUSES,
  OPERATION_REASONS,
  REVIEW_BOTTLENECKS,
} from './enums.js';

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

/**
 * Whether a stored action string is one this codebase actually writes.
 *
 * `AUDIT_ACTIONS` is deliberately shorter than the `target_type` list beside it. Moderation,
 * `ends_at` backfill and anything about feedback are named in §7 as things the audit will one day
 * describe, and the code that would write them belongs to CO-06, CO-08 and CO-09. Listing an action
 * nobody writes reads as a behaviour that exists, and the first person to search for it finds an
 * enum value and no implementation; each of those tickets adds its value alongside the code that
 * emits it.
 *
 * Member feedback is not audited at all, and that is a decision rather than an omission: §5.7 keeps
 * an individual pulse private, and an audit stream naming who submitted one and when would be the
 * disclosure that rule exists to prevent.
 */
export const isAuditAction = (action: string): action is AuditAction =>
  (AUDIT_ACTIONS as readonly string[]).includes(action);
