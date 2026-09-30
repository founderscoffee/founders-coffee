import { createServerFn } from '@tanstack/react-start';

import { appValidator, handleResult } from '@founders-coffee/core';
import { chat } from '@founders-coffee/domain';

import { requireAuth } from '../authz.js';
import { requirePermission } from '../auth-middleware.js';
import { getDb } from '../db.js';
import { RATE_BUDGETS } from '../rate-budgets.js';
import { limitedTo } from '../rate-limit.js';
import { privateNoStore } from '../response-cache.js';
import { markChatReadResolver, setChatMutedResolver } from './members.js';
import {
  listChatMessagesResolver,
  removeChatMessageResolver,
  sendChatMessageResolver,
} from './messages.js';
import { readChatPageResolver } from './page.js';
import { reportChatMessageResolver } from './reports.js';
import { readChatUnreadCountsResolver } from './unread.js';

/** What a member's chat panel shows when it opens: the chat, its latest messages, their own state. */
export const getChatPage = createServerFn({ strict: false })
  .middleware([requirePermission('chat', 'read')])
  .validator(appValidator(chat.chatPageSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      readChatPageResolver(getDb(), {
        eventId: data.eventId,
        viewerId: requireAuth(context.session).user.id,
        now: new Date(),
      }),
    );
  });

/**
 * How many messages the member has not read in each of their chats among `eventIds`, for the
 * meetup page's chat entry and the activity list. The ids are a filter, never an authorisation,
 * and the answer is the member's own, so it is kept out of every shared cache.
 */
export const getChatUnreadCounts = createServerFn({
  method: 'GET',
  strict: false,
})
  .middleware([requirePermission('chat', 'read')])
  .validator(appValidator(chat.chatUnreadCountsSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      readChatUnreadCountsResolver(getDb(), {
        userId: requireAuth(context.session).user.id,
        eventIds: data.eventIds,
      }),
    );
  });

/** A page of a chat's history before a message the member holds, or the gap after one. */
export const listChatMessages = createServerFn({ strict: false })
  .middleware([requirePermission('chat', 'read')])
  .validator(appValidator(chat.listChatMessagesSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      listChatMessagesResolver(getDb(), {
        ...data,
        viewerId: requireAuth(context.session).user.id,
      }),
    );
  });

/** Post a message to a meetup's chat, once however often the device retries it. */
export const sendChatMessage = createServerFn({ method: 'POST', strict: false })
  .middleware([
    requirePermission('chat', 'write'),
    limitedTo(RATE_BUDGETS.chat.send),
  ])
  .validator(appValidator(chat.sendChatMessageSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      sendChatMessageResolver(getDb(), {
        ...data,
        authorId: requireAuth(context.session).user.id,
      }),
    );
  });

/** Remove a message as its author or as the meetup's host, leaving its tombstone. */
export const removeChatMessage = createServerFn({
  method: 'POST',
  strict: false,
})
  .middleware([
    requirePermission('chat', 'write'),
    limitedTo(RATE_BUDGETS.chat.remove),
  ])
  .validator(appValidator(chat.removeChatMessageSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      removeChatMessageResolver(getDb(), {
        messageId: data.messageId,
        actorId: requireAuth(context.session).user.id,
      }),
    );
  });

/** Record how far the member has read the chat. */
export const markChatRead = createServerFn({ method: 'POST', strict: false })
  .middleware([
    requirePermission('chat', 'write'),
    limitedTo(RATE_BUDGETS.chat.markRead),
  ])
  .validator(appValidator(chat.markChatReadSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      markChatReadResolver(getDb(), {
        ...data,
        userId: requireAuth(context.session).user.id,
      }),
    );
  });

/** Mute or unmute the chat for the member. */
export const setChatMuted = createServerFn({ method: 'POST', strict: false })
  .middleware([
    requirePermission('chat', 'write'),
    limitedTo(RATE_BUDGETS.chat.mute),
  ])
  .validator(appValidator(chat.setChatMutedSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      setChatMutedResolver(getDb(), {
        ...data,
        userId: requireAuth(context.session).user.id,
      }),
    );
  });

/** Report someone else's message for a moderator to review. */
export const reportChatMessage = createServerFn({
  method: 'POST',
  strict: false,
})
  .middleware([
    requirePermission('chat', 'write'),
    limitedTo(RATE_BUDGETS.chat.report),
  ])
  .validator(appValidator(chat.reportChatMessageSchema))
  .handler(({ context, data }) => {
    privateNoStore();
    return handleResult(
      reportChatMessageResolver(getDb(), {
        ...data,
        reporterId: requireAuth(context.session).user.id,
      }),
    );
  });
