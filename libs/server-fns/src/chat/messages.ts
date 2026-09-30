import {
  AppError,
  err,
  ok,
  type ChatMessageRemoval,
  type Result,
} from '@founders-coffee/core';
import {
  readChatMessages,
  removeChatMessage,
  sendChatMessage,
  type ChatMessageCursor,
  type Db,
} from '@founders-coffee/db';

import { armNotificationSchedule } from '../notifications/schedule.js';
import { admitReader, chatNotFound, notChatMember } from './access.js';
import { tellChatRoom } from './room.js';
import { chatUnreadNotice } from './unread.js';
import { chatMessageView, type ChatMessageView } from './view.js';

export interface ChatMessagesPage {
  readonly messages: readonly ChatMessageView[];
  readonly hasMore: boolean;
}

export interface RemovedChatMessage {
  readonly id: string;
  readonly removal: ChatMessageRemoval;
}

/**
 * Post a member's message to the chat of `eventId`, answering a retry with the message its first
 * attempt stored.
 *
 * Whether the sender belongs to the chat and whether it is still open are decided by the database
 * in the statement that writes, so the answer here only names the refusal: no chat, not a member,
 * or a chat that no longer takes messages. A stored message is pushed to the members with the chat
 * open, a retried one too, since its first attempt may have stopped between the write and the push;
 * a page already holding it drops the copy by its id.
 *
 * The same write queues the other members' `chat_unread` pushes, two minutes out, and the meetup's
 * schedule is woken for them as `host-notice.ts` wakes it, only when some were queued.
 */
export const sendChatMessageResolver = async (
  db: Db,
  input: { eventId: string; authorId: string; body: string; clientId: string },
): Promise<Result<ChatMessageView>> => {
  const unread = chatUnreadNotice(new Date());
  const result = await sendChatMessage(db, { ...input, unread });
  switch (result.outcome) {
    case 'sent':
    case 'already_sent': {
      const message = result.message;
      await tellChatRoom(input.eventId, 'chat_push_message', (room) =>
        room.broadcast({ type: 'message', message }),
      );
      if (result.noticesQueued > 0)
        await armNotificationSchedule(input.eventId, unread.sendAt);
      return ok(chatMessageView(message, input.authorId));
    }
    case 'chat_missing':
      return err(chatNotFound());
    case 'not_member':
      return err(notChatMember());
    case 'read_only':
      return err(
        new AppError('chat_read_only', 'This chat no longer takes messages'),
      );
  }
};

/** One page of a chat's messages for a member, older than a message they hold or newer than one. */
export const listChatMessagesResolver = async (
  db: Db,
  input: {
    eventId: string;
    viewerId: string;
    before?: ChatMessageCursor;
    after?: ChatMessageCursor;
    limit: number;
  },
): Promise<Result<ChatMessagesPage>> => {
  const page = await readChatMessages(db, input);
  const admitted = admitReader(page.access);
  if (!admitted.ok) return admitted;
  return ok({
    messages: page.messages.map((row) => chatMessageView(row, input.viewerId)),
    hasMore: page.hasMore,
  });
};

/**
 * Remove a message as its author, or as the host of its meetup, and push its tombstone to the
 * members with the chat open.
 *
 * Anything the one conditional write leaves alone is answered alike: a message that is not there,
 * one already removed, a system message, or one the actor may not touch. Telling those apart would
 * tell someone outside the chat which message ids exist in it.
 */
export const removeChatMessageResolver = async (
  db: Db,
  input: { messageId: string; actorId: string },
): Promise<Result<RemovedChatMessage>> => {
  const removed = await removeChatMessage(db, input);
  if (!removed?.removal)
    return err(
      new AppError('chat_message_not_found', 'This message cannot be removed'),
    );
  const tombstone = { id: removed.id, removal: removed.removal };
  await tellChatRoom(removed.eventId, 'chat_push_removal', (room) =>
    room.broadcast({ type: 'removed', ...tombstone }),
  );
  return ok(tombstone);
};
