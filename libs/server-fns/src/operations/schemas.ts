import { z } from 'zod';

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
        userId: z.string().min(1),
        outcome: z.enum(['attended', 'no_show']),
      }),
    )
    .max(200)
    .default([]),
});

export type CloseoutViewRequest = z.infer<typeof closeoutViewRequestSchema>;
export type CloseoutStatesRequest = z.infer<typeof closeoutStatesRequestSchema>;
export type SubmitCloseoutRequest = z.infer<typeof submitCloseoutRequestSchema>;
