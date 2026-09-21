import { z } from 'zod';

import { attendanceOutcomeSchema, userIdSchema } from '@founders-coffee/core';
import { operations } from '@founders-coffee/domain';

export const closeoutViewRequestSchema = z.strictObject({
  eventId: z.string().min(1),
});

export const closeoutStatesRequestSchema = z.strictObject({
  eventIds: z.array(z.string().min(1)).max(100).default([]),
});

export const submitCloseoutRequestSchema = z.strictObject({
  closeout: operations.submitCloseoutSchema,
  attendance: z
    .array(
      z.strictObject({
        userId: userIdSchema,
        outcome: attendanceOutcomeSchema,
      }),
    )
    .max(200)
    .default([]),
});

export const feedbackViewRequestSchema = z.strictObject({
  eventId: z.string().min(1),
});

export const submitFeedbackRequestSchema = z.strictObject({
  feedback: operations.submitFeedbackSchema,
});

export const feedbackTallyRequestSchema = z.strictObject({
  eventId: z.string().min(1),
});

export type CloseoutViewRequest = z.infer<typeof closeoutViewRequestSchema>;
export type CloseoutStatesRequest = z.infer<typeof closeoutStatesRequestSchema>;
export type SubmitCloseoutRequest = z.infer<typeof submitCloseoutRequestSchema>;
export type FeedbackViewRequest = z.infer<typeof feedbackViewRequestSchema>;
export type SubmitFeedbackRequest = z.infer<typeof submitFeedbackRequestSchema>;
export type FeedbackTallyRequest = z.infer<typeof feedbackTallyRequestSchema>;
