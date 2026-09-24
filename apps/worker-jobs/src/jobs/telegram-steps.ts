import { ok } from '@founders-coffee/core';
import {
  closeTelegramGroup,
  closeTelegramGroupsForChat,
  deleteTelegramInvites,
  isTelegramChatInUse,
  isTelegramMemberOfChat,
  listTelegramInvites,
  moveTelegramChat,
  setTelegramPinnedMessage,
  takeTelegramInvite,
  type Db,
  type EventTelegramGroupRow,
} from '@founders-coffee/db';
import type { notifications } from '@founders-coffee/domain';
import type {
  TelegramBotProvider,
  TelegramFailure,
  TelegramResult,
} from '@founders-coffee/notifications';
import { logger } from '@founders-coffee/observability';

import type { DispatchOutcome } from './dispatch-outcome.js';

export type Step = DispatchOutcome | null;

export const isTransient = (failure: TelegramFailure): boolean =>
  failure.kind === 'rate_limited' || failure.kind === 'unavailable';

export const refused = (failure: TelegramFailure): DispatchOutcome => ({
  kind: 'failed',
  permanent: !isTransient(failure),
  error: `telegram_${failure.kind}: ${failure.message}`,
});

export const refusedPermanently = (error: string): DispatchOutcome => ({
  kind: 'failed',
  permanent: true,
  error,
});

/**
 * One row's conversation with one chat.
 *
 * A basic group that Telegram upgrades to a supergroup gets a new chat id, and the next call to the
 * old one is refused with the new id attached. Every call goes through `call`, which moves the
 * meetup's rows to the new id and tries once more, so the upgrade costs a retry and not a row. A
 * chat the bot has been removed from, or that no longer exists, closes every meetup still using it
 * and withdraws their queued posts, the same as the webhook does when it hears of the removal.
 */
export const chatSession = (
  db: Db,
  startChatId: number,
  now: Date,
): {
  chatId: () => number;
  call: <T>(
    request: (chatId: number) => Promise<TelegramResult<T>>,
  ) => Promise<TelegramResult<T>>;
} => {
  let chatId = startChatId;
  const settle = async <T>(
    result: TelegramResult<T>,
  ): Promise<TelegramResult<T>> => {
    if (!result.ok && result.error.kind === 'chat_gone')
      await closeTelegramGroupsForChat(db, { chatId, now });
    return result;
  };
  const call = async <T>(
    request: (chatId: number) => Promise<TelegramResult<T>>,
  ): Promise<TelegramResult<T>> => {
    const first = await request(chatId);
    if (first.ok || first.error.kind !== 'migrated') return settle(first);
    await moveTelegramChat(db, {
      fromChatId: chatId,
      toChatId: first.error.chatId,
      now,
    });
    chatId = first.error.chatId;
    return settle(await request(chatId));
  };
  return { chatId: () => chatId, call };
};

export type Session = ReturnType<typeof chatSession>;

/** Post `text` to the chat, without a link preview. */
export const post = async (
  telegram: TelegramBotProvider,
  session: Session,
  text: string | undefined,
): Promise<Step> => {
  if (text === undefined)
    return refusedPermanently('telegram_payload_incomplete: nothing to post');
  const posted = await session.call((chatId) =>
    telegram.sendMessage({ chatId, text }),
  );
  return posted.ok ? null : refused(posted.error);
};

/**
 * Pin a message, silently. A pin refused for good is logged and let go, because the message it was
 * for is already in the chat and the words are what matter; a refusal worth retrying holds the row.
 */
const pin = async (
  telegram: TelegramBotProvider,
  session: Session,
  eventId: string,
  messageId: number,
): Promise<Step> => {
  const pinned = await session.call((chatId) =>
    telegram.pinMessage({ chatId, messageId }),
  );
  if (pinned.ok) return null;
  if (isTransient(pinned.error)) return refused(pinned.error);
  logger.warn('telegram.pin_failed', { eventId, reason: pinned.error.message });
  return null;
};

/**
 * Make the pinned message say `text`, posting and pinning a new one when there is none to edit.
 *
 * The message id is stored before the pin is attempted, so a pin that fails and is retried finds a
 * message to edit rather than posting a second copy. Editing text that has not changed is success,
 * so a retried row passes straight through, and the message is pinned again after every edit in
 * case someone unpinned it. A pinned message Telegram will no longer edit, deleted or too old, is
 * replaced by a new one.
 */
export const pinDetails = async (
  db: Db,
  telegram: TelegramBotProvider,
  session: Session,
  group: EventTelegramGroupRow,
  text: string | undefined,
  now: Date,
): Promise<Step> => {
  if (text === undefined)
    return refusedPermanently('telegram_payload_incomplete: nothing to pin');
  const pinnedId = group.pinnedMessageId;
  if (pinnedId !== null) {
    const edited = await session.call((chatId) =>
      telegram.editMessage({ chatId, messageId: pinnedId, text }),
    );
    if (edited.ok || edited.error.kind === 'not_modified')
      return pin(telegram, session, group.eventId, pinnedId);
    if (isTransient(edited.error) || edited.error.kind === 'chat_gone')
      return refused(edited.error);
  }
  const posted = await session.call((chatId) =>
    telegram.sendMessage({ chatId, text, withPreview: true }),
  );
  if (!posted.ok) return refused(posted.error);
  await setTelegramPinnedMessage(db, {
    eventId: group.eventId,
    messageId: posted.data.messageId,
    now,
  });
  return pin(telegram, session, group.eventId, posted.data.messageId);
};

/**
 * Stop the group admitting anyone for this meetup: closed first, then every invite link revoked.
 *
 * The group is marked closed before Telegram is asked anything, so from this moment every join
 * request is declined, whatever happens to the calls that follow. Each invite is forgotten as its
 * link is revoked, so a retried row only revokes what is left. A link Telegram no longer knows is as
 * good as revoked, and only a refusal worth retrying holds the row back, and not on its last try:
 * the invites, and the Telegram accounts they name, go with the group whatever Telegram says.
 */
export const closeGroup = async (
  db: Db,
  telegram: TelegramBotProvider,
  session: Session,
  group: EventTelegramGroupRow,
  opts: { now: Date; lastTry: boolean },
): Promise<Step> => {
  await closeTelegramGroup(db, { eventId: group.eventId, now: opts.now });
  for (const invite of await listTelegramInvites(db, group.eventId)) {
    const revoked = await session.call((chatId) =>
      telegram.revokeInviteLink({ chatId, inviteLink: invite.inviteLink }),
    );
    if (!revoked.ok && isTransient(revoked.error) && !opts.lastTry)
      return refused(revoked.error);
    await takeTelegramInvite(db, {
      eventId: invite.eventId,
      userId: invite.userId,
    });
    if (!revoked.ok && revoked.error.kind === 'chat_gone') break;
  }
  await deleteTelegramInvites(db, group.eventId);
  return null;
};

/**
 * Leave the chat, unless a meetup still runs through it.
 *
 * The check counts every live group on the chat, the meetup's own included, so a host who
 * disconnected a group and at once connected it again keeps the bot. It is made on the chat the
 * call actually goes to, which is the new one after an upgrade. A chat the bot is already out of is
 * left.
 */
export const leaveChat = async (
  db: Db,
  telegram: TelegramBotProvider,
  session: Session,
): Promise<Step> => {
  const left = await session.call(async (chatId) =>
    (await isTelegramChatInUse(db, chatId))
      ? ok(undefined)
      : telegram.leaveChat({ chatId }),
  );
  return left.ok || left.error.kind === 'chat_gone'
    ? null
    : refused(left.error);
};

/**
 * Revoke links whose invites are already gone from the table.
 *
 * A link Telegram no longer knows is as good as revoked, and a chat that is gone takes its links with
 * it. Only a refusal worth retrying holds the row, and the retry revokes the whole list again.
 */
export const revokeLinks = async (
  telegram: TelegramBotProvider,
  session: Session,
  links: readonly string[],
): Promise<Step> => {
  for (const inviteLink of links) {
    const revoked = await session.call((chatId) =>
      telegram.revokeInviteLink({ chatId, inviteLink }),
    );
    if (revoked.ok) continue;
    if (isTransient(revoked.error)) return refused(revoked.error);
    if (revoked.error.kind === 'chat_gone') return null;
  }
  return null;
};

/**
 * Take a member who cancelled out of the chat, and revoke the link they were given.
 *
 * The link goes first, so it admits nobody even if the removal is refused. The removal asks, on the
 * chat the call is actually made to, whether the account still belongs there through another going
 * member's invite, which covers a second meetup in the same group and a member who came back.
 * Removing is a ban lifted at once, so they can join again if they RSVP again.
 */
export const removeMember = async (
  db: Db,
  telegram: TelegramBotProvider,
  session: Session,
  payload: notifications.TelegramNotificationPayload,
): Promise<Step> => {
  const link = payload.telegramInviteLink;
  const unrevoked = await revokeLinks(
    telegram,
    session,
    link === undefined ? [] : [link],
  );
  if (unrevoked) return unrevoked;
  const userId = payload.telegramUserId;
  if (userId === undefined) return null;
  const removed = await session.call(async (chatId) =>
    (await isTelegramMemberOfChat(db, { chatId, telegramUserId: userId }))
      ? ok(undefined)
      : telegram.removeMember({ chatId, userId }),
  );
  return removed.ok ? null : refused(removed.error);
};

/** Run steps in order, and stop at the first one Telegram refused. */
export const firstRefusal = async (
  steps: readonly (() => Promise<Step>)[],
): Promise<Step> => {
  for (const step of steps) {
    const refusal = await step();
    if (refusal) return refusal;
  }
  return null;
};
