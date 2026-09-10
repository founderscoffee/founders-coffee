import { z } from 'zod';

import {
  idSchema,
  localeSchema,
  marketCodeSchema,
} from '@founders-coffee/core';

import {
  attendanceOutcomeSchema,
  closeoutOutcomeSchema,
  feedbackRatingSchema,
  hostFrictionListSchema,
  hostTrustStatusSchema,
  operationReasonSchema,
  reviewBottleneckSchema,
} from './enum-schemas.js';

export const FEEDBACK_COMMENT_MAX_LENGTH = 600;
export const REVIEW_TEXT_MAX_LENGTH = 1000;
export const PRIVATE_NOTE_MAX_LENGTH = 500;
export const WALK_IN_MAX = 500;

export const operationsVersionSchema = z.number().int().nonnegative();

export const walkInCountSchema = z.number().int().min(0).max(WALK_IN_MAX);

/**
 * What a host submits when an event is over.
 *
 * `wouldHostAgain` is nullable rather than defaulted: "did not answer" and "no" are different
 * facts, and §6 reports host-again intent as a share of pulses that were actually submitted. A
 * default would quietly enrol every silent host in one answer or the other.
 *
 * The walk-in tally is bounded on both ends. Non-negative because a negative attendance is not a
 * correction but a data-entry error that would silently reduce a market's totals; capped because
 * this is a café meetup and a four-figure walk-in count is a typo rather than a turnout. It is the
 * one field on the closeout that can move a community-health metric by orders of magnitude.
 *
 * A `did_not_happen` closeout carries no walk-ins by construction — the refinement below rejects
 * them rather than zeroing them, because a host who typed a number and an outcome that contradict
 * each other has made a mistake worth showing them.
 *
 * The correction schema below is the same shape plus `expectedVersion` and a required `reason`:
 * a correction is conditional on the version the corrector was looking at, so two admins editing
 * the same closeout produce one winner rather than a silent overwrite, and §5.22 treats an
 * unexplained correction as indistinguishable from a mistake in the audit stream.
 */
export const submitCloseoutSchema = z
  .strictObject({
    eventId: idSchema,
    outcome: closeoutOutcomeSchema,
    walkInCount: walkInCountSchema.default(0),
    wouldHostAgain: z.boolean().nullable().default(null),
    hostFriction: hostFrictionListSchema.default([]),
    privateNote: z.string().trim().max(PRIVATE_NOTE_MAX_LENGTH).optional(),
  })
  .superRefine((input, context) => {
    if (input.outcome === 'did_not_happen' && input.walkInCount > 0) {
      context.addIssue({
        code: 'custom',
        message: 'An event that did not happen cannot have walk-ins',
        path: ['walkInCount'],
      });
    }
    if (input.hostFriction.includes('other_structured') && !input.privateNote) {
      context.addIssue({
        code: 'custom',
        message: 'Describe the other friction in the private note',
        path: ['privateNote'],
      });
    }
  });

export const correctCloseoutSchema = z
  .strictObject({
    eventId: idSchema,
    expectedVersion: operationsVersionSchema,
    outcome: closeoutOutcomeSchema,
    walkInCount: walkInCountSchema,
    wouldHostAgain: z.boolean().nullable(),
    hostFriction: hostFrictionListSchema,
    privateNote: z.string().trim().max(PRIVATE_NOTE_MAX_LENGTH).optional(),
    reason: operationReasonSchema,
  })
  .superRefine((input, context) => {
    if (input.outcome === 'did_not_happen' && input.walkInCount > 0) {
      context.addIssue({
        code: 'custom',
        message: 'An event that did not happen cannot have walk-ins',
        path: ['walkInCount'],
      });
    }
    if (input.hostFriction.includes('other_structured') && !input.privateNote) {
      context.addIssue({
        code: 'custom',
        message: 'Describe the other friction in the private note',
        path: ['privateNote'],
      });
    }
  });

export const recordAttendanceSchema = z.strictObject({
  eventId: idSchema,
  userId: idSchema,
  outcome: attendanceOutcomeSchema,
});

export const recordAttendanceBatchSchema = z.strictObject({
  eventId: idSchema,
  outcomes: z
    .array(
      z.strictObject({ userId: idSchema, outcome: attendanceOutcomeSchema }),
    )
    .min(1)
    .max(200),
});

export const correctAttendanceSchema = recordAttendanceSchema.extend({
  reason: operationReasonSchema,
});

/**
 * The attendee pulse: three questions, one of them optional.
 *
 * Attendance itself carries no name and no way to add one: §5.4 scopes it to members who held a
 * valid `going` RSVP, the repository enforces that in the same statement that writes the row, and
 * anonymous turnout stays the aggregate on the closeout without creating an identity.
 *
 * A comment carries its authored language because §5.23 renders it as written and never translates
 * it — a comment whose language is unknown either gets guessed at or gets rendered with the wrong
 * typography and direction, and both are worse than asking. The pair is enforced together: a
 * language without a comment is as meaningless as a comment without one.
 */
export const submitFeedbackSchema = z
  .strictObject({
    eventId: idSchema,
    rating: feedbackRatingSchema,
    wouldReturn: z.boolean(),
    comment: z
      .string()
      .trim()
      .max(FEEDBACK_COMMENT_MAX_LENGTH)
      .optional()
      .transform((value) => (value ? value : undefined)),
    commentLanguage: localeSchema.optional(),
  })
  .superRefine((input, context) => {
    if (input.comment && !input.commentLanguage) {
      context.addIssue({
        code: 'custom',
        message: 'A comment needs the language it was written in',
        path: ['commentLanguage'],
      });
    }
    if (!input.comment && input.commentLanguage) {
      context.addIssue({
        code: 'custom',
        message: 'There is no comment for this language to describe',
        path: ['comment'],
      });
    }
  });

export const updateHostTrustSchema = z
  .strictObject({
    marketCode: marketCodeSchema,
    userId: idSchema,
    status: hostTrustStatusSchema,
    reason: operationReasonSchema.nullable().default(null),
  })
  .superRefine((input, context) => {
    if (input.status === 'restricted' && !input.reason) {
      context.addIssue({
        code: 'custom',
        message: 'Restricting a host requires a recorded reason',
        path: ['reason'],
      });
    }
  });

/**
 * One weekly decision, which is the operating record and not a note.
 *
 * The evidence window is explicit rather than implied by the row's creation time, because a review
 * held late still describes the week it was about. `intervention` and `followUpResult` are bounded
 * operational text with no member PII — §5.14 keeps names, contacts and comments out of anything
 * that leaves D1, and this record is read by the dashboard.
 */
export const recordReviewSchema = z
  .strictObject({
    marketCode: marketCodeSchema,
    stateCode: z.string().trim().min(1).max(8).nullable().default(null),
    cityCode: z.string().trim().min(1).max(16).nullable().default(null),
    windowStart: z.number().int().positive(),
    windowEnd: z.number().int().positive(),
    bottleneck: reviewBottleneckSchema,
    intervention: z.string().trim().min(1).max(REVIEW_TEXT_MAX_LENGTH),
    ownerUserId: idSchema,
    dueAt: z.number().int().positive(),
  })
  .superRefine((input, context) => {
    if (input.windowEnd <= input.windowStart) {
      context.addIssue({
        code: 'custom',
        message: 'The evidence window must end after it starts',
        path: ['windowEnd'],
      });
    }
    if (input.cityCode && !input.stateCode) {
      context.addIssue({
        code: 'custom',
        message: 'A city scope needs the state it belongs to',
        path: ['stateCode'],
      });
    }
  });

export type SubmitCloseoutInput = z.infer<typeof submitCloseoutSchema>;
export type CorrectCloseoutInput = z.infer<typeof correctCloseoutSchema>;
export type RecordAttendanceInput = z.infer<typeof recordAttendanceSchema>;
export type RecordAttendanceBatchInput = z.infer<
  typeof recordAttendanceBatchSchema
>;
export type CorrectAttendanceInput = z.infer<typeof correctAttendanceSchema>;
export type SubmitFeedbackInput = z.infer<typeof submitFeedbackSchema>;
export type UpdateHostTrustInput = z.infer<typeof updateHostTrustSchema>;
export type RecordReviewInput = z.infer<typeof recordReviewSchema>;
