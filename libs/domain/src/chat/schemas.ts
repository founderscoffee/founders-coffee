import { z } from 'zod';

import { chatReportReasonSchema, idSchema } from '@founders-coffee/core';

import { chatMessageBodySchema } from './body.js';

export const CHAT_PAGE_SIZE = 50;

export const chatClientIdSchema = z.uuid();

export const chatCursorSchema = z.strictObject({
  at: z.number().int().nonnegative(),
  id: idSchema,
});

export const sendChatMessageSchema = z.strictObject({
  eventId: idSchema,
  body: chatMessageBodySchema,
  clientId: chatClientIdSchema,
});

export const listChatMessagesSchema = z
  .strictObject({
    eventId: idSchema,
    before: chatCursorSchema.optional(),
    after: chatCursorSchema.optional(),
    limit: z.number().int().min(1).max(CHAT_PAGE_SIZE).default(CHAT_PAGE_SIZE),
  })
  .refine((input) => input.before === undefined || input.after === undefined, {
    message: 'Page before a message or after one, not both',
    path: ['after'],
  });

export const removeChatMessageSchema = z.strictObject({ messageId: idSchema });

export const markChatReadSchema = z.strictObject({
  eventId: idSchema,
  at: z.number().int().nonnegative(),
});

export const setChatMutedSchema = z.strictObject({
  eventId: idSchema,
  muted: z.boolean(),
});

export const reportChatMessageSchema = z.strictObject({
  messageId: idSchema,
  reason: chatReportReasonSchema,
});

export const chatPageSchema = z.strictObject({ eventId: idSchema });

export const CHAT_UNREAD_COUNTS_MAX = 100;

export const chatUnreadCountsSchema = z.strictObject({
  eventIds: z.array(idSchema).min(1).max(CHAT_UNREAD_COUNTS_MAX),
});

export type ChatCursor = z.infer<typeof chatCursorSchema>;
export type SendChatMessageInput = z.infer<typeof sendChatMessageSchema>;
export type ListChatMessagesInput = z.infer<typeof listChatMessagesSchema>;
export type RemoveChatMessageInput = z.infer<typeof removeChatMessageSchema>;
export type MarkChatReadInput = z.infer<typeof markChatReadSchema>;
export type SetChatMutedInput = z.infer<typeof setChatMutedSchema>;
export type ReportChatMessageInput = z.infer<typeof reportChatMessageSchema>;
export type ChatPageInput = z.infer<typeof chatPageSchema>;
export type ChatUnreadCountsInput = z.infer<typeof chatUnreadCountsSchema>;
