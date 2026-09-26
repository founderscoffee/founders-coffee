import { z } from 'zod';

const chatSchema = z.object({
  id: z.number().int(),
  type: z.string(),
  title: z.string().optional(),
});

const userSchema = z.object({ id: z.number().int() });

const messageSchema = z.object({
  chat: chatSchema,
  from: userSchema.optional(),
  sender_chat: z.object({ id: z.number().int() }).optional(),
  text: z.string().optional(),
  migrate_to_chat_id: z.number().int().optional(),
});

const memberChangeSchema = z.object({
  chat: chatSchema,
  new_chat_member: z.object({ status: z.string(), user: userSchema }),
});

const joinRequestSchema = z.object({
  chat: chatSchema,
  from: userSchema,
  invite_link: z
    .object({ invite_link: z.string(), creator: userSchema })
    .optional(),
});

export const telegramUpdateSchema = z.object({
  update_id: z.number().int(),
  message: messageSchema.optional(),
  my_chat_member: memberChangeSchema.optional(),
  chat_join_request: joinRequestSchema.optional(),
});

export type TelegramUpdate = z.infer<typeof telegramUpdateSchema>;
export type TelegramMessage = z.infer<typeof messageSchema>;
export type TelegramJoinRequest = z.infer<typeof joinRequestSchema>;

/**
 * Read an update's body, or `null` for one that is not an update this bot can act on.
 *
 * Only the fields the bot uses are kept. As an admin the bot is sent every message in its groups;
 * their text is kept only to be matched against the connect command, and never reaches a log.
 */
export const parseTelegramUpdate = (
  bytes: Uint8Array,
): TelegramUpdate | null => {
  try {
    const parsed = telegramUpdateSchema.safeParse(
      JSON.parse(new TextDecoder().decode(bytes)),
    );
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
};
