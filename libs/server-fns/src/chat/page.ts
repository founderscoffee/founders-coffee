import { ok, type Result } from '@founders-coffee/core';
import { readChatPage, type Db } from '@founders-coffee/db';
import { chat } from '@founders-coffee/domain';

import { admitReader } from './access.js';
import { chatMessageView, type ChatMessageView } from './view.js';

export interface ChatPage {
  readonly isHost: boolean;
  readonly state: chat.ChatState;
  readonly readOnlyAt: Date;
  readonly messages: readonly ChatMessageView[];
  readonly hasOlder: boolean;
  readonly lastReadAt: Date | null;
  readonly muted: boolean;
}

/**
 * What a member's chat panel shows when it opens, from one trip to D1.
 *
 * The chat, whether the reader belongs to it, its latest page of messages with their authors and
 * the reader's own read marker and mute all come back in one batch, so opening the panel waits on
 * one round trip to the database's region. A read-only chat still opens, since its history is the
 * members' to read until it is deleted; `state` tells the panel not to offer the composer, and
 * `isHost` tells it whose messages the reader may remove.
 */
export const readChatPageResolver = async (
  db: Db,
  input: { eventId: string; viewerId: string; now: Date },
): Promise<Result<ChatPage>> => {
  const page = await readChatPage(db, {
    eventId: input.eventId,
    viewerId: input.viewerId,
    limit: chat.CHAT_PAGE_SIZE,
  });
  const admitted = admitReader(page.access);
  if (!admitted.ok) return admitted;
  return ok({
    isHost: admitted.data.hostId === input.viewerId,
    state: chat.chatState(admitted.data, input.now),
    readOnlyAt: admitted.data.readOnlyAt,
    messages: page.messages.map((row) => chatMessageView(row, input.viewerId)),
    hasOlder: page.hasOlder,
    lastReadAt: page.member?.lastReadAt ?? null,
    muted: page.member?.muted ?? false,
  });
};
