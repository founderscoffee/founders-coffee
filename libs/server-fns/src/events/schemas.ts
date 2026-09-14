import { z } from 'zod';

import { eventCreateSchema } from '@founders-coffee/domain';

export const eventCreateRequestSchema = z
  .object({ event: eventCreateSchema })
  .strict();

export type EventCreateRequestInput = z.infer<typeof eventCreateRequestSchema>;

export const EVENT_CANCEL_REASON_MAX_LENGTH = 280;

export const eventCancelRequestSchema = z
  .object({
    eventId: z.string().min(1).max(64),
    reason: z.string().trim().max(EVENT_CANCEL_REASON_MAX_LENGTH).optional(),
  })
  .strict();

export type EventCancelRequestInput = z.infer<typeof eventCancelRequestSchema>;

export const hostedEventsRequestSchema = z
  .object({
    hostId: z.string().min(1).max(128),
    marketCode: z.string().min(2).max(8).optional(),
    beforeStartsAt: z.number().int().positive().optional(),
    beforeId: z.string().min(1).max(64).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();

export type HostedEventsRequestInput = z.infer<
  typeof hostedEventsRequestSchema
>;

export const repeatEventRequestSchema = z
  .object({ eventId: z.string().min(1).max(64) })
  .strict();

export type RepeatEventRequestInput = z.infer<typeof repeatEventRequestSchema>;

export const joinedEventsRequestSchema = z
  .object({
    marketCode: z.string().min(2).max(8).optional(),
    beforeStartsAt: z.number().int().positive().optional(),
    beforeId: z.string().min(1).max(64).optional(),
    limit: z.number().int().min(1).max(50).optional(),
  })
  .strict();

export type JoinedEventsRequestInput = z.infer<
  typeof joinedEventsRequestSchema
>;

export const publicEventFeedRequestSchema = z.strictObject({
  market: z.string().trim().toLowerCase().min(1).max(80).optional(),
  cursor: z.string().trim().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export type PublicEventFeedRequestInput = z.infer<
  typeof publicEventFeedRequestSchema
>;
