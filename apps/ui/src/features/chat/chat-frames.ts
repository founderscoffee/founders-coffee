import { z } from 'zod';

import {
  chatMessageKindSchema,
  chatMessageRemovalSchema,
} from '@founders-coffee/core';

import type { ChatMessageView, ChatRemoval } from './api';

const chatMessage = z.object({
  id: z.string(),
  kind: chatMessageKindSchema,
  body: z.string(),
  systemKey: z.string().nullable(),
  systemParams: z.record(z.string(), z.string()).nullable(),
  createdAt: z.coerce.date(),
  removal: chatMessageRemovalSchema.nullable(),
  author: z
    .object({
      id: z.string(),
      name: z.string().nullable(),
      photoAssetId: z.string().nullable(),
    })
    .nullable(),
  isOwn: z.boolean(),
  clientId: z.string().nullable(),
});

const chatFrame = z.discriminatedUnion('type', [
  z.object({ type: z.literal('message'), message: chatMessage }),
  z.object({
    type: z.literal('removed'),
    id: z.string(),
    removal: chatMessageRemovalSchema,
  }),
  z.object({ type: z.literal('closed') }),
  z.object({ type: z.literal('revoked') }),
]);

export type ChatFrame =
  | { readonly type: 'message'; readonly message: ChatMessageView }
  | ({ readonly type: 'removed' } & ChatRemoval)
  | { readonly type: 'closed' }
  | { readonly type: 'revoked' };

/**
 * What the chat's room pushed, or `null` for anything it would not send.
 *
 * The room sends JSON, so a message's time arrives as text and is read back into a date, as the
 * server functions' own answers bring it. A heartbeat's acknowledgement and anything malformed are
 * nothing to act on.
 */
export const parseChatFrame = (data: unknown): ChatFrame | null => {
  if (typeof data !== 'string') return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  const frame = chatFrame.safeParse(parsed);
  return frame.success ? frame.data : null;
};
