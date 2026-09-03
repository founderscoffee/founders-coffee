import { z } from 'zod';

import { eventCreateSchema } from '@founders-coffee/domain';

export const eventCreateRequestSchema = z
  .object({ event: eventCreateSchema })
  .strict();

export type EventCreateRequestInput = z.infer<typeof eventCreateRequestSchema>;
