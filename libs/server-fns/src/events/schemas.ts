import { z } from 'zod';

import { eventCreateSchema } from '@founders-coffee/domain';

export const eventCreateRequestSchema = z
  .object({
    event: eventCreateSchema,
    turnstileToken: z.string().trim().max(2_048).optional(),
  })
  .strict();

export type EventCreateRequestInput = z.infer<typeof eventCreateRequestSchema>;
