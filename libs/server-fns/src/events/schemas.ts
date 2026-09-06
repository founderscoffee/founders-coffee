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
