import { z } from 'zod';

import {
  attendanceOutcomeSchema as coreAttendanceOutcomeSchema,
  auditActionSchema as coreAuditActionSchema,
  auditTargetSchema as coreAuditTargetSchema,
  closeoutOutcomeSchema as coreCloseoutOutcomeSchema,
  feedbackRatingSchema as coreFeedbackRatingSchema,
  hostFrictionSchema as coreHostFrictionSchema,
  hostTrustStatusSchema as coreHostTrustStatusSchema,
  operationReasonSchema as coreOperationReasonSchema,
  reviewBottleneckSchema as coreReviewBottleneckSchema,
} from '@founders-coffee/core';

import { AUDIT_ACTIONS, HOST_FRICTIONS } from './enums.js';

export const closeoutOutcomeSchema = coreCloseoutOutcomeSchema;
export const attendanceOutcomeSchema = coreAttendanceOutcomeSchema;
export const feedbackRatingSchema = coreFeedbackRatingSchema;
export const hostTrustStatusSchema = coreHostTrustStatusSchema;
export const hostFrictionSchema = coreHostFrictionSchema;
export const operationReasonSchema = coreOperationReasonSchema;
export const reviewBottleneckSchema = coreReviewBottleneckSchema;
export const auditTargetSchema = coreAuditTargetSchema;
export const auditActionSchema = coreAuditActionSchema;

/**
 * The friction a host reports, as a set rather than a sentence.
 *
 * Bounded and de-duplicated because these values are counted across markets and months: free text
 * cannot be, and a list that admits the same value twice inflates whatever counts it. The closeout
 * collects structured categories and not an operational diary — the
 * place for prose is the weekly review, which a human writes and nothing aggregates.
 *
 * `other_structured` is deliberately a category and not an escape hatch for text. A bounded private
 * note in D1 is required when it is used, and that note never reaches Analytics.
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
 * `ends_at` backfill and anything about feedback are things the audit will one day describe, and the code that would write them belongs to CO-06, CO-08 and CO-09. Listing an action
 * nobody writes reads as a behaviour that exists, and the first person to search for it finds an
 * enum value and no implementation; each of those tickets adds its value alongside the code that
 * emits it.
 *
 * Member feedback is not audited at all, and that is a decision rather than an omission: an
 * individual pulse stays private, and an audit stream naming who submitted one and when would be
 * the disclosure that rule exists to prevent.
 */
export const isAuditAction = (action: string): action is AuditAction =>
  (AUDIT_ACTIONS as readonly string[]).includes(action);
