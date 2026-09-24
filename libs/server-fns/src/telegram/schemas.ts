import { z } from 'zod';

export const telegramGroupRequestSchema = z
  .object({
    eventId: z.string().min(1).max(64),
  })
  .strict();

export type TelegramGroupRequest = z.infer<typeof telegramGroupRequestSchema>;
